import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { targetFromArgs } from '../scripts/bundle-paths.mjs'
import { collect, formatMiB, main, overBudget, topNodeModules } from '../scripts/size-report.mjs'

const roots: string[] = []

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'size-report-'))

  roots.push(dir)

  return dir
}

afterEach(() => {
  vi.restoreAllMocks()

  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

/** Minimal bundle tree for one layout. */
function writeBundle(bundle: string, offset: number): void {
  const app = path.join(bundle, 'macos', 'Test.app')
  const macos = path.join(app, 'Contents', 'MacOS')
  const resources = path.join(app, 'Contents', 'Resources')

  fs.mkdirSync(macos, { recursive: true })
  fs.mkdirSync(resources, { recursive: true })
  fs.writeFileSync(path.join(macos, 'unplatform-ai-server'), Buffer.alloc(10 + offset))
  fs.writeFileSync(path.join(macos, 'unplatform-ai'), Buffer.alloc(20 + offset))
  fs.writeFileSync(path.join(macos, 'ffmpeg'), Buffer.alloc(30 + offset))
  fs.writeFileSync(path.join(resources, 'server.tar.zst'), Buffer.alloc(5 + offset))
  fs.writeFileSync(path.join(resources, 'server.build-id'), Buffer.alloc(1))
  fs.writeFileSync(path.join(bundle, 'macos', 'Test.app.tar.gz'), Buffer.alloc(7 + offset))
  fs.mkdirSync(path.join(bundle, 'dmg'), { recursive: true })
  fs.writeFileSync(path.join(bundle, 'dmg', 'Test.dmg'), Buffer.alloc(9 + offset))
}

describe('size-report', () => {
  it('reads the target from the flag or the Tauri env', () => {
    expect(targetFromArgs(['--target', 'aarch64-apple-darwin'], {})).toBe('aarch64-apple-darwin')
    expect(targetFromArgs(['--target=x86_64-apple-darwin'], {})).toBe('x86_64-apple-darwin')

    expect(targetFromArgs([], { TAURI_ENV_TARGET_TRIPLE: 'x86_64-unknown-linux-gnu' })).toBe(
      'x86_64-unknown-linux-gnu',
    )

    expect(targetFromArgs([], {})).toBeUndefined()
  })

  it('skips on a non-macOS host', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main()

    expect(log).toHaveBeenCalledWith('[size-report] macOS only, skipped')
  })

  it('collects the default layout and the install total', async () => {
    const root = tempDir()
    const bundle = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
    const runtime = path.join(root, 'runtime', '0.4.0')

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.4.0' }))
    writeBundle(bundle, 0)
    fs.mkdirSync(runtime, { recursive: true })
    fs.writeFileSync(path.join(runtime, 'server.js'), Buffer.alloc(40))

    const report = await collect({ root, runtimeDir: runtime, env: {} })

    expect(report.parts.serverBinary).toBe(10)
    expect(report.parts.shell).toBe(20)
    expect(report.parts.ffmpeg).toBe(30)
    expect(report.parts.serverResources).toBe(5)
    expect(report.parts.appTotal).toBe(66)
    expect(report.parts.runtimeTotal).toBe(40)
    expect(report.parts.installTotal).toBe(106)
    expect(report.parts.dmg).toBe(9)
    expect(report.parts.appTarGz).toBe(7)
  })

  it('collects a target layout', async () => {
    const root = tempDir()
    const target = 'x86_64-apple-darwin'
    const bundle = path.join(root, 'src-tauri', 'target', target, 'release', 'bundle')

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.4.0' }))
    writeBundle(bundle, 100)

    const runtime = path.join(root, 'runtime')
    const report = await collect({ root, target, runtimeDir: runtime, env: {} })

    expect(report.app).toBe(path.relative(root, path.join(bundle, 'macos', 'Test.app')))
    expect(report.parts.serverBinary).toBe(110)
    expect(report.parts.shell).toBe(120)
    expect(report.parts.ffmpeg).toBe(130)
    expect(report.parts.serverResources).toBe(105)
    expect(report.parts.appTotal).toBe(466)
    expect(report.parts.runtimeTotal).toBe(0)
    expect(report.parts.installTotal).toBe(466)
    expect(report.parts.dmg).toBe(109)
    expect(report.parts.appTarGz).toBe(107)
  })

  it('formats bytes as MiB', () => {
    expect(formatMiB(1024 * 1024)).toBe('1.0 MiB')
    expect(formatMiB(1536 * 1024)).toBe('1.5 MiB')
  })

  it('fails only above baseline plus five percent', () => {
    expect(overBudget(105, 100)).toBe(false)
    expect(overBudget(106, 100)).toBe(true)
  })

  it('expands scopes and the pnpm store', async () => {
    const root = tempDir()
    const modules = path.join(root, 'node_modules')

    const write = (name: string, size: number): void => {
      fs.mkdirSync(path.dirname(path.join(modules, name)), { recursive: true })
      fs.writeFileSync(path.join(modules, name), Buffer.alloc(size))
    }

    write('next/index.js', 30)
    write('@img/sharp-libvips/index.js', 20)
    write('.pnpm/sharp@1/node_modules/sharp/index.js', 10)

    const entries = await topNodeModules(modules, 3)

    expect(
      entries.map((entry) => {
        return entry.name
      }),
    ).toEqual(['next', '@img/sharp-libvips', '.pnpm/sharp@1'])
  })
})
