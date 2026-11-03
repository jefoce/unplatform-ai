import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-ffmpeg-'))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  const { stopAllFfmpeg } = await import('@/server/media/ffmpeg')

  stopAllFfmpeg()
  await fs.rm(dir, { recursive: true, force: true })
})

describe('runFfmpeg', () => {
  // execFile cannot launch a .cmd on Windows without a shell, the timeout path is covered on macOS and Linux.
  it.skipIf(process.platform === 'win32')('kills a sleeping child at the timeout', async () => {
    const bin = path.join(dir, 'ffmpeg')

    await fs.writeFile(bin, '#!/usr/bin/env node\nsetTimeout(() => {}, 10_000)\n', { mode: 0o755 })
    vi.resetModules()
    vi.stubEnv('FFMPEG_PATH', bin)

    const { runFfmpeg } = await import('@/server/media/ffmpeg')
    const started = Date.now()

    await expect(runFfmpeg({ args: [], timeoutMs: 100 })).rejects.toThrow(
      'ffmpeg timed out after 100 ms',
    )

    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
