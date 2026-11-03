import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { stageSidecar } from '../scripts/prepare-desktop.mjs'

const roots: string[] = []

const tempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-desktop-'))

  roots.push(dir)

  return dir
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
    expect(chmod).toHaveBeenCalledWith(temp, 0o755)
    expect(rename).toHaveBeenCalledWith(temp, target)
    expect(sign).toHaveBeenCalledWith(target)
    expect(verify).toHaveBeenCalledWith(target)
    expect(calls).toEqual(['sign', 'verify'])
    expect(await fs.readFile(target, 'utf8')).toBe('binary')
    expect((await fs.stat(target)).mode & 0o777).toBe(0o755)
    expect((await fs.stat(target)).ino).not.toBe(before)
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

    expect(chmod).toHaveBeenCalledWith(temp, 0o755)
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
