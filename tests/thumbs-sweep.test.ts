import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { THUMB_UNUSED_DAYS } from '@/core/constants'
import { sweepThumbs } from '@/server/media/thumbs'

const DAY_MS = 86_400_000

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-thumbs-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

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
    await writeThumb('old.webp', 10, (THUMB_UNUSED_DAYS + 1) * DAY_MS)
    await writeThumb('fresh.webp', 10, 0)

    expect(await sweepThumbs({ dir })).toBe(1)
    expect(await names()).toEqual(['fresh.webp'])
  })

  it('keeps everything under the size cap', async () => {
    await writeThumb('a.webp', 40, DAY_MS)
    await writeThumb('b.webp', 40, 2 * DAY_MS)

    expect(await sweepThumbs({ dir, maxBytes: 100, targetBytes: 60 })).toBe(0)
    expect(await names()).toEqual(['a.webp', 'b.webp'])
  })

  it('removes the oldest files until under the target size', async () => {
    await writeThumb('old.webp', 60, 3 * DAY_MS)
    await writeThumb('mid.webp', 40, 2 * DAY_MS)
    await writeThumb('new.webp', 30, DAY_MS)

    expect(await sweepThumbs({ dir, maxBytes: 100, targetBytes: 60 })).toBe(2)
    expect(await names()).toEqual(['new.webp'])
  })
})
