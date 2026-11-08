import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { bundleDir } from '../scripts/bundle-paths.mjs'
import { main, repackArchive } from '../scripts/compress-downloads.mjs'

const roots: string[] = []

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-downloads-'))

  roots.push(dir)

  return dir
}

afterEach(() => {
  vi.restoreAllMocks()

  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('compress-downloads', () => {
  it('resolves the bundle from the target triple', () => {
    const root = '/tmp/unplatform-ai'
    const target = 'x86_64-unknown-linux-gnu'

    expect(bundleDir({ root, target, env: {} })).toBe(
      path.join(root, 'src-tauri', 'target', target, 'release', 'bundle'),
    )

    expect(bundleDir({ root, env: {} })).toBe(
      path.join(root, 'src-tauri', 'target', 'release', 'bundle'),
    )
  })

  it('resolves the bundle from CARGO_TARGET_DIR', () => {
    const root = '/tmp/unplatform-ai'
    const target = 'x86_64-unknown-linux-gnu'

    expect(
      bundleDir({ root, target, env: { CARGO_TARGET_DIR: '/Volumes/ram/upai-build/cargo' } }),
    ).toBe(path.join('/Volumes/ram/upai-build/cargo', target, 'release', 'bundle'))

    expect(bundleDir({ root, env: { CARGO_TARGET_DIR: '../cargo' } })).toBe(
      path.join(root, '..', 'cargo', 'release', 'bundle'),
    )

    expect(bundleDir({ root, env: {} })).toBe(
      path.join(root, 'src-tauri', 'target', 'release', 'bundle'),
    )
  })

  it('skips on a non-macOS host', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main()

    expect(log).toHaveBeenCalledWith('[compress] macOS only, skipped')
  })

  it('packs the app bundle into a gzip archive', async () => {
    const root = tempDir()
    const appDir = path.join(root, 'macos')
    const payload = path.join(appDir, 'Test.app', 'Contents', 'payload')

    fs.mkdirSync(path.dirname(payload), { recursive: true })
    fs.writeFileSync(payload, 'unplatform-ai')

    const archive = path.join(appDir, 'Test.app.tar.gz')

    await repackArchive({ appDir, appName: 'Test.app', archive })

    const text = gunzipSync(fs.readFileSync(archive)).toString()

    expect(text).toContain('Test.app/Contents/payload')
  })
})
