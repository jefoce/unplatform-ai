import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = await mkdtemp(path.join(os.tmpdir(), 'cf-temp-sweep-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const { sweepInterruptedTemps } = await import('@/server/fs/temp-sweep')

const { COMPAT_DIR, DATA_DIR, DOWNLOADS_DIR, IMAGES_DIR, THUMBS_DIR, UPLOADS_DIR } =
  await import('@/server/paths')

const ownedDirs = [DOWNLOADS_DIR, IMAGES_DIR, UPLOADS_DIR, DATA_DIR, THUMBS_DIR, COMPAT_DIR]

const strayTemps = [
  path.join(DATA_DIR, `endpoints.json.tmp-${randomUUID()}`),
  path.join(IMAGES_DIR, `${randomUUID()}-0.png.tmp-${randomUUID()}`),
  path.join(THUMBS_DIR, `x.webp.tmp-${randomUUID()}`),
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
    [...strayTemps, keepFile, recordFile, partFile].map((file) => {
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

    expect(removed).toBe(strayTemps.length)

    for (const file of strayTemps) {
      expect(await exists(file)).toBe(false)
    }

    expect(await exists(keepFile)).toBe(true)
    expect(await exists(recordFile)).toBe(true)
    expect(await exists(partFile)).toBe(true)
  })
})
