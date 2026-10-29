import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { THUMB_UNUSED_DAYS } from '@/core/constants'
import type { sweepThumbs as SweepThumbs } from '@/server/media/thumbs'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `thumbs-sweep-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const DAY_MS = 86_400_000

process.env.STORAGE_ROOT = ROOT

let dir = ''
let sweepThumbs: typeof SweepThumbs

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ sweepThumbs } = await import('@/server/media/thumbs'))

  ;({ THUMBS_DIR: dir } = await import('@/server/paths'))
})

beforeEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Thumb names are content hashes, so the guard accepts them. */
function thumbName(char: string): string {
  return `${char.repeat(40)}.webp`
}

async function writeThumb(name: string, size: number, ageMs: number): Promise<void> {
  const file = path.join(dir, name)

  await fs.writeFile(file, Buffer.alloc(size))
  const at = new Date(Date.now() - ageMs)

  await fs.utimes(file, at, at)
}

async function names(): Promise<string[]> {
  return (await fs.readdir(dir)).sort()
}

describe('sweepThumbs', () => {
  it('removes files untouched for 30 days and keeps fresh ones', async () => {
    await writeThumb(thumbName('a'), 10, (THUMB_UNUSED_DAYS + 1) * DAY_MS)
    await writeThumb(thumbName('b'), 10, 0)

    expect(await sweepThumbs({ dir })).toBe(1)
    expect(await names()).toEqual([thumbName('b')])
  })

  it('keeps everything under the size cap', async () => {
    await writeThumb(thumbName('a'), 40, DAY_MS)
    await writeThumb(thumbName('b'), 40, 2 * DAY_MS)

    expect(await sweepThumbs({ dir, maxBytes: 100, targetBytes: 60 })).toBe(0)
    expect(await names()).toEqual([thumbName('a'), thumbName('b')])
  })

  it('removes the oldest files until under the target size', async () => {
    await writeThumb(thumbName('a'), 60, 3 * DAY_MS)
    await writeThumb(thumbName('b'), 40, 2 * DAY_MS)
    await writeThumb(thumbName('c'), 30, DAY_MS)

    expect(await sweepThumbs({ dir, maxBytes: 100, targetBytes: 60 })).toBe(2)
    expect(await names()).toEqual([thumbName('c')])
  })

  it('keeps files the app does not own and counts only owned removals', async () => {
    const old = (THUMB_UNUSED_DAYS + 1) * DAY_MS

    await writeThumb(thumbName('a'), 10, old)
    await fs.writeFile(path.join(dir, '.DS_Store'), 'junk')
    const at = new Date(Date.now() - old)

    await fs.utimes(path.join(dir, '.DS_Store'), at, at)

    expect(await sweepThumbs({ dir })).toBe(1)
    expect(await names()).toEqual(['.DS_Store'])
  })

  it('keeps going when one unlink fails', async () => {
    const old = (THUMB_UNUSED_DAYS + 1) * DAY_MS

    await writeThumb(thumbName('a'), 10, old)
    await writeThumb(thumbName('b'), 10, old)

    const failing = path.join(dir, thumbName('a'))
    const realUnlink = fs.unlink.bind(fs)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(fs, 'unlink').mockImplementation(async (file) => {
      if (file === failing) {
        const error: NodeJS.ErrnoException = new Error('EPERM: operation not permitted')

        error.code = 'EPERM'

        throw error
      }

      await realUnlink(file)
    })

    expect(await sweepThumbs({ dir })).toBe(1)
    expect(await names()).toEqual([thumbName('a')])
    expect(warn).toHaveBeenCalled()
  })
})
