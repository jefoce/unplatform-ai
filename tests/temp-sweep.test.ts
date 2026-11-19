import { randomUUID } from 'node:crypto'
import fs, { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const root = await mkdtemp(path.join(os.tmpdir(), 'cf-temp-sweep-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const { sweepInterruptedTemps } = await import('@/server/fs/temp-sweep')

const {
  COMPAT_DIR,
  DATA_DIR,
  DOWNLOADS_DIR,
  IMAGES_DIR,
  STORAGE_TMP_DIR,
  THUMBS_DIR,
  UPLOADS_DIR,
} = await import('@/server/paths')

const ownedDirs = [
  DOWNLOADS_DIR,
  IMAGES_DIR,
  UPLOADS_DIR,
  STORAGE_TMP_DIR,
  DATA_DIR,
  THUMBS_DIR,
  COMPAT_DIR,
]

const hash = (char: string): string => {
  return char.repeat(40)
}

const strayTemps = [
  path.join(DATA_DIR, `endpoints.json.tmp-${randomUUID()}`),
  path.join(IMAGES_DIR, `${randomUUID()}-0.png.tmp-${randomUUID()}`),
  path.join(THUMBS_DIR, `x.webp.tmp-${randomUUID()}`),
  path.join(THUMBS_DIR, `${hash('a')}.tmp-${randomUUID()}.png`),
  path.join(COMPAT_DIR, `${hash('b')}.tmp-${randomUUID()}.mp4`),
  path.join(DOWNLOADS_DIR, `${randomUUID()}.frame.tmp-${randomUUID()}.png`),
  path.join(STORAGE_TMP_DIR, `upload-probe.tmp-${randomUUID()}.png`),
]

const legacyTemps = [
  path.join(THUMBS_DIR, `${hash('c')}.${randomUUID()}.tmp.png`),
  path.join(COMPAT_DIR, `${hash('d')}.${randomUUID()}.tmp.m4a`),
  path.join(DOWNLOADS_DIR, `${randomUUID()}.frame-${randomUUID()}.tmp.png`),
]

const keepFile = path.join(DATA_DIR, 'keep.json')
const recordFile = path.join(DOWNLOADS_DIR, `${randomUUID()}.json`)
const partFile = path.join(DOWNLOADS_DIR, `${randomUUID()}.mp4.part`)

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

beforeAll(async () => {
  await Promise.all(
    ownedDirs.map((dir) => {
      return mkdir(dir, { recursive: true })
    }),
  )

  await Promise.all(
    [...strayTemps, ...legacyTemps, keepFile, recordFile, partFile].map((file) => {
      return writeFile(file, 'bytes')
    }),
  )
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('sweepInterruptedTemps', () => {
  it('removes interrupted temp files and keeps records and parts', async () => {
    const removed = await sweepInterruptedTemps()

    expect(removed).toBe(strayTemps.length + legacyTemps.length)

    for (const file of [...strayTemps, ...legacyTemps]) {
      expect(await exists(file)).toBe(false)
    }

    expect(await exists(keepFile)).toBe(true)
    expect(await exists(recordFile)).toBe(true)
    expect(await exists(partFile)).toBe(true)
  })

  it('keeps sweeping after an unlink fails', async () => {
    const failing = path.join(DATA_DIR, `fail.tmp-${randomUUID()}`)
    const later = path.join(DATA_DIR, `later.tmp-${randomUUID()}`)

    await writeFile(failing, 'bytes')
    await writeFile(later, 'bytes')

    const realUnlink = fs.unlink.bind(fs)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(fs, 'unlink').mockImplementation(async (file) => {
      if (file === failing) {
        const error: NodeJS.ErrnoException = new Error('EACCES: permission denied')

        error.code = 'EACCES'

        throw error
      }

      await realUnlink(file)
    })

    await expect(sweepInterruptedTemps()).resolves.toBe(1)
    expect(await exists(failing)).toBe(true)
    expect(await exists(later)).toBe(false)
    expect(warn).toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
