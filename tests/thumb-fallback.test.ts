import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compact } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const FIXTURE_PNG = fileURLToPath(new URL('./fixtures/media/sample.png', import.meta.url))
const FIXTURE_MP4 = fileURLToPath(new URL('./fixtures/media/sample.mp4', import.meta.url))

// Fails at the seek point, writes a real PNG only for the first frame.
function fakeFfmpeg(attemptsFile: string, failMarker: string): string {
  return `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
const at = args[args.indexOf('-ss') + 1]
const out = args[args.length - 1]
fs.appendFileSync(${JSON.stringify(attemptsFile)}, at + '\\n')
if (fs.existsSync(${JSON.stringify(failMarker)}) || at !== '0') {
  process.stderr.write('no frame at requested position\\n')
  process.exit(1)
}
fs.copyFileSync(${JSON.stringify(FIXTURE_PNG)}, out)
`
}

let dir = ''
let attemptsFile = ''
let failMarker = ''

async function readAttempts(): Promise<string[]> {
  const text = await fs.readFile(attemptsFile, 'utf8')

  return compact(text.split('\n'))
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-poster-'))
  attemptsFile = path.join(dir, 'attempts.txt')
  failMarker = path.join(dir, 'fail')

  const bin = path.join(dir, 'ffmpeg')

  await fs.writeFile(bin, fakeFfmpeg(attemptsFile, failMarker), { mode: 0o755 })
  await fs.writeFile(attemptsFile, '')

  vi.resetModules()
  vi.stubEnv('FFMPEG_PATH', bin)
  vi.stubEnv('STORAGE_ROOT', path.join(dir, 'storage'))
})

afterEach(async () => {
  const { stopAllFfmpeg } = await import('@/server/media/ffmpeg')

  stopAllFfmpeg()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(dir, { recursive: true, force: true })
})

describe.skipIf(process.platform === 'win32')('poster fallback', () => {
  it('renders a thumb from the first frame when the seek has none', async () => {
    const { getThumbnail } = await import('@/server/media/thumbs')

    const result = await getThumbnail({
      ref: 'short-clip',
      absolutePath: FIXTURE_MP4,
      kind: 'video',
      mtimeMs: 1,
      width: 320,
    })

    expect(await readAttempts()).toEqual(['0.5', '0'])
    expect((await fs.stat(result.filePath)).size).toBeGreaterThan(0)
  })

  it('returns the preview name from the fallback frame', async () => {
    const { makePreview } = await import('@/server/media/preview')
    const out = path.join(dir, 'clip.preview.png')

    const name = await makePreview({ id: 'clip', video: FIXTURE_MP4, out })

    expect(name).toBe('clip.preview.png')
    expect(await readAttempts()).toEqual(['0.5', '0'])
    expect((await fs.stat(out)).size).toBeGreaterThan(0)
  })

  it('logs the stderr tail and rethrows when both attempts fail', async () => {
    const { extractPosterFrame } = await import('@/server/media/poster-frame')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    await fs.writeFile(failMarker, '')

    await expect(
      extractPosterFrame({
        videoPath: FIXTURE_MP4,
        width: 320,
        outPath: path.join(dir, 'frame.png'),
      }),
    ).rejects.toThrow('ffmpeg failed')

    expect(errorLog).toHaveBeenCalledWith(
      '[unplatform-ai] poster frame failed',
      expect.stringContaining('no frame at requested position'),
    )

    expect(await readAttempts()).toEqual(['0.5', '0'])
  })
})
