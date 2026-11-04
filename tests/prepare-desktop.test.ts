import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { packArchive, stageSidecar, unpackArchive } from '../scripts/prepare-desktop.mjs'

const roots: string[] = []

const tempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-desktop-'))

  roots.push(dir)

  return dir
}

/** Stats after checking the sidecar is a file, mode on POSIX only. */
async function statStagedSidecar(target: string) {
  const stats = await fs.stat(target)

  if (process.platform === 'win32') {
    expect(stats.isFile()).toBe(true)
  } else {
    expect(stats.mode & 0o777).toBe(0o755)
  }

  return stats
}

/** Files under `dir`, mapped to their bytes by relative path. */
async function readTree(dir: string, relative = ''): Promise<Map<string, Buffer>> {
  const tree = new Map<string, Buffer>()

  for (const entry of await fs.readdir(path.join(dir, relative), { withFileTypes: true })) {
    const next = relative === '' ? entry.name : `${relative}/${entry.name}`

    if (entry.isDirectory()) {
      for (const [key, value] of await readTree(dir, next)) {
        tree.set(key, value)
      }
    } else {
      tree.set(next, await fs.readFile(path.join(dir, next)))
    }
  }

  return tree
}

afterEach(async () => {
  vi.restoreAllMocks()

  for (const root of roots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true })
  }
})

describe('stageSidecar', () => {
  it('stages through a temp file, signs, then verifies on macOS', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const target = path.join(root, 'ffmpeg-aarch64-apple-darwin')
    const temp = `${target}.tmp-${process.pid}`

    await fs.writeFile(source, 'binary')
    await fs.writeFile(target, 'poisoned')

    const before = (await fs.stat(target)).ino
    const copyFile = vi.spyOn(fs, 'copyFile')
    const chmod = vi.spyOn(fs, 'chmod')
    const rename = vi.spyOn(fs, 'rename')
    const calls: string[] = []

    const sign = vi.fn(async () => {
      calls.push('sign')
    })

    const verify = vi.fn(async () => {
      calls.push('verify')

      return 'none'
    })

    await stageSidecar({
      source,
      target,
      platform: { name: 'darwin-arm64' },
      sign,
      verify,
    })

    expect(copyFile).toHaveBeenCalledWith(source, temp)

    if (process.platform !== 'win32') {
      expect(chmod).toHaveBeenCalledWith(temp, 0o755)
    }

    expect(rename).toHaveBeenCalledWith(temp, target)
    expect(sign).toHaveBeenCalledWith(target)
    expect(verify).toHaveBeenCalledWith(target)
    expect(calls).toEqual(['sign', 'verify'])
    expect(await fs.readFile(target, 'utf8')).toBe('binary')

    const targetStats = await statStagedSidecar(target)

    expect(targetStats.ino).not.toBe(before)
    await expect(fs.access(temp)).rejects.toThrow()
  })

  it('removes the temp file when a later step fails', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const target = path.join(root, 'ffmpeg-x86_64-unknown-linux-gnu')
    const temp = `${target}.tmp-${process.pid}`

    await fs.writeFile(source, 'binary')

    const chmod = vi.spyOn(fs, 'chmod').mockRejectedValueOnce(new Error('chmod failed'))

    await expect(
      stageSidecar({
        source,
        target,
        platform: { name: 'linux-x64' },
        sign: vi.fn(),
      }),
    ).rejects.toThrow('chmod failed')

    if (process.platform !== 'win32') {
      expect(chmod).toHaveBeenCalledWith(temp, 0o755)
    }

    await expect(fs.access(temp)).rejects.toThrow()
    await expect(fs.access(target)).rejects.toThrow()
  })

  it('skips the signature outside macOS', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const target = path.join(root, 'ffmpeg-x86_64-unknown-linux-gnu')

    await fs.writeFile(source, 'binary')

    const sign = vi.fn()
    const verify = vi.fn()

    await stageSidecar({
      source,
      target,
      platform: { name: 'linux-x64' },
      sign,
      verify,
    })

    expect(sign).not.toHaveBeenCalled()
    expect(verify).toHaveBeenCalledWith(target)
    expect(await fs.readFile(target, 'utf8')).toBe('binary')
  })
})

describe('packArchive', () => {
  it('packs a directory into a zstd tar that unpacks to the same files', async () => {
    const root = await tempDir()
    const source = path.join(root, 'source')
    const archive = path.join(root, 'server.tar.zst')
    const out = path.join(root, 'out')

    await fs.mkdir(path.join(source, 'nested'), { recursive: true })
    await fs.writeFile(path.join(source, 'alpha.txt'), 'alpha')
    await fs.writeFile(path.join(source, 'nested', 'bytes.bin'), Buffer.from([0, 1, 2, 255]))

    await packArchive(source, archive)
    await fs.mkdir(out)
    await unpackArchive(archive, out)

    expect(await readTree(out)).toEqual(await readTree(source))
  })
})
