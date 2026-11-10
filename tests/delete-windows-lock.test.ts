import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import { storedRecord } from './helpers/stored-record'

const ROOT = path.join(os.tmpdir(), `cf-delete-windows-lock-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const DOWNLOADS = path.join(ROOT, 'downloads')
const QUEUE = path.join(ROOT, 'data', 'cleanup-queue.json')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const originalPlatform = process.platform

process.env.STORAGE_ROOT = ROOT

vi.mock('node:timers/promises', () => {
  return { setTimeout: async () => {} }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const realUnlink = fs.unlink.bind(fs)

const repo = await import('@/server/repos/images')
const generations = await import('@/server/repos/generations')
const { flushCleanupQueue } = await import('@/server/fs/cleanup-queue')
const { DELETE } = await import('@/app/api/images/[id]/route')

let testIndex = 0

beforeAll(() => {
  Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
  await fs.mkdir(DOWNLOADS, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await fs.utimes(DOWNLOADS, stamp, stamp)
  await repo.listImages()
  await generations.listGenerations()
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function busy(code = 'EBUSY'): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: file is locked`), { code })
}

function record(id: string, outputs: ImageOutput[]): ImageRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    outputs,
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

interface Seeded {
  id: string
  json: string
  file: string
}

async function seedImage(): Promise<Seeded> {
  const id = randomUUID()
  const file = path.join(IMAGES, `${id}-0.png`)

  await fs.writeFile(file, 'bytes')

  const output: ImageOutput = {
    id: randomUUID(),
    index: 0,
    status: 'saved',
    file: `${id}-0.png`,
    mediaType: 'image/png',
    width: 1,
    height: 1,
    bytes: 5,
    favorite: false,
    seed: null,
  }

  await repo.saveImage(record(id, [output]))

  return { id, json: path.join(IMAGES, `${id}.json`), file }
}

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

async function queuedPaths(): Promise<string[]> {
  const text = await fs.readFile(QUEUE, 'utf8').catch(() => {
    return null
  })

  if (text === null) {
    return []
  }

  const parsed = JSON.parse(text) as { paths?: string[] }

  return parsed.paths ?? []
}

function lockUnlink(file: string): void {
  vi.spyOn(fs, 'unlink').mockImplementation(async (target) => {
    if (String(target) === file) {
      throw busy()
    }

    await realUnlink(target)
  })
}

function deleteRequest(id: string): Request {
  return new Request(`http://127.0.0.1:3000/api/images/${id}`, {
    method: 'DELETE',
    headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
  })
}

describe('Windows delete lock', () => {
  it('retries a short lock and deletes the image files', async () => {
    const seeded = await seedImage()
    let attempts = 0

    vi.spyOn(fs, 'unlink').mockImplementation(async (target) => {
      if (String(target) === seeded.file && attempts < 2) {
        attempts += 1

        throw busy()
      }

      await realUnlink(target)
    })

    await repo.deleteImageFiles(seeded.id)

    expect(attempts).toBe(2)
    expect(await repo.getImage(seeded.id)).toBeNull()
    expect(await exists(seeded.json)).toBe(false)
    expect(await exists(seeded.file)).toBe(false)
    expect(await exists(QUEUE)).toBe(false)
  })

  it('queues a permanently locked output and logs its basename', async () => {
    const seeded = await seedImage()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    lockUnlink(seeded.file)

    await expect(repo.deleteImageFiles(seeded.id)).resolves.toBeUndefined()

    expect(await repo.getImage(seeded.id)).toBeNull()
    expect(await exists(seeded.json)).toBe(false)
    expect(await exists(seeded.file)).toBe(true)
    expect(await queuedPaths()).toEqual([seeded.file])
    expect(warn).toHaveBeenCalledTimes(1)

    const line = String(warn.mock.calls[0]?.[0] ?? '')

    expect(line).toContain(path.basename(seeded.file))
    expect(line).toContain('EBUSY')
  })

  it('returns 204 for a delete with a permanently locked output', async () => {
    const seeded = await seedImage()

    lockUnlink(seeded.file)

    const response = await DELETE(deleteRequest(seeded.id), {
      params: Promise.resolve({ id: seeded.id }),
    })

    expect(response.status).toBe(204)
    expect(await repo.getImage(seeded.id)).toBeNull()
    expect(await queuedPaths()).toEqual([seeded.file])
  })

  it('queues a locked video on a generation delete', async () => {
    const id = randomUUID()
    const video = path.join(DOWNLOADS, `${id}.mp4`)

    await generations.saveGeneration(storedRecord(id))
    await fs.writeFile(video, 'video')
    lockUnlink(video)

    await expect(generations.deleteGenerationFiles(id)).resolves.toBeUndefined()

    expect(await generations.getGeneration(id)).toBeNull()
    expect(await exists(video)).toBe(true)
    expect(await queuedPaths()).toEqual([video])
  })

  it('flushes queued deletes on the next start', async () => {
    const seeded = await seedImage()

    const unlink = vi.spyOn(fs, 'unlink').mockImplementation(async (target) => {
      if (String(target) === seeded.file) {
        throw busy()
      }

      await realUnlink(target)
    })

    await repo.deleteImageFiles(seeded.id)

    expect(await queuedPaths()).toEqual([seeded.file])

    unlink.mockRestore()
    await flushCleanupQueue()

    expect(await exists(seeded.file)).toBe(false)
    expect(await exists(QUEUE)).toBe(false)
  })
})
