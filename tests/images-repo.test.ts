import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import sharp from '@/server/media/sharp'
import type * as ImagesRepoModule from '@/server/repos/images'
import type * as ImageFilesModule from '@/server/services/image-files'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-images-repo-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let repo: typeof ImagesRepoModule
let files: typeof ImageFilesModule

beforeAll(async () => {
  repo = await import('@/server/repos/images')
  files = await import('@/server/services/image-files')
})

let testIndex = 0

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  // The store caches by directory mtime, so force a fresh mtime and reload.
  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(id: string): ImageRecord {
  const now = '2026-01-01T00:00:00.000Z'

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'unknown',
      billed: null,
    },
  }
}

async function png(width = 4, height = 2): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: '#3366ff' },
  })
    .png()
    .toBuffer()

  return Uint8Array.from(buffer)
}

describe('images repo', () => {
  it('saves, gets and lists records by uuid file name', async () => {
    const id = randomUUID()

    const saved = await repo.saveImage(record(id))

    expect(saved.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(await repo.getImage(id)).toEqual(saved)
    expect(await repo.listImages()).toEqual([saved])
    expect(await fs.readFile(path.join(IMAGES, `${id}.json`), 'utf8')).toContain(id)
  })

  it('returns null for an invalid id', async () => {
    expect(await repo.getImage('../escape')).toBeNull()
  })

  it('writes an output file and reads its dimensions', async () => {
    const id = randomUUID()

    const output = await files.writeImageOutput({
      recordId: id,
      outputId: randomUUID(),
      index: 0,
      bytes: await png(8, 6),
      mediaType: 'image/png',
    })

    expect(output).toMatchObject({
      status: 'saved',
      width: 8,
      height: 6,
      file: `${id}-0.png`,
    })

    const file = repo.imageOutputFile(output)
    const stats = await fs.stat(file ?? '')

    expect(stats.isFile()).toBe(true)
  })

  it('deletes the json and every output file', async () => {
    const id = randomUUID()
    const saved = await repo.saveImage(record(id))

    const first = await files.writeImageOutput({
      recordId: id,
      outputId: randomUUID(),
      index: 0,
      bytes: await png(),
      mediaType: 'image/png',
    })

    const second = await files.writeImageOutput({
      recordId: id,
      outputId: randomUUID(),
      index: 1,
      bytes: await png(),
      mediaType: 'image/webp',
    })

    await repo.saveImage({ ...saved, outputs: [first, second] })
    await repo.deleteImageFiles(id)

    expect(await repo.getImage(id)).toBeNull()
    expect(await repo.listImages()).toEqual([])

    for (const output of [first, second]) {
      const file = repo.imageOutputFile(output)

      const stats = await fs.stat(file ?? '').catch(() => {
        return null
      })

      expect(stats).toBeNull()
    }
  })

  it('treats a missing record as already deleted', async () => {
    await expect(repo.deleteImageFiles(randomUUID())).resolves.toBeUndefined()
    await expect(repo.deleteImageFiles('not-a-uuid')).resolves.toBeUndefined()
  })
})
