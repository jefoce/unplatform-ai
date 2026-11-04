import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-queue-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const gate = vi.hoisted(() => {
  const entered = Promise.withResolvers<void>()
  const open = Promise.withResolvers<void>()

  return {
    enter: entered.resolve,
    pending: entered.promise,
    release: open.resolve,
    opened: open.promise,
  }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: () => {
      return {
        id: 'openrouter',
        isConfigured: () => {
          return true
        },
        generate: async () => {
          gate.enter()
          await gate.opened

          return {
            items: [
              {
                b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                mediaType: 'image/png',
              },
            ],
            costUsd: 0,
          }
        },
        listModels: async () => {
          return { models: [], isFresh: true }
        },
        testConnection: async () => {
          return { ok: true }
        },
      }
    },
  }
})

interface ImagesModule {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
}

interface QueueModule {
  configureImageSubmitQueue: (params: {
    run: (id: string, signal?: AbortSignal) => Promise<'done' | 'requeue'>
  }) => void
  startImageSubmit: (id: string) => Promise<void>
  imageSendingCount: () => number
  waitForImageSendingDone: (timeoutMs: number) => Promise<boolean>
}

let repo: ImagesModule
let queue: QueueModule

beforeAll(async () => {
  await fs.mkdir(IMAGES, { recursive: true })
  repo = await import('@/server/repos/images')

  const { runImageSubmit } = await import('@/server/jobs/image-run')

  queue = await import('@/server/jobs/image-submit-queue')
  queue.configureImageSubmitQueue({ run: runImageSubmit })
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
  const now = new Date().toISOString()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
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
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    outputs: [],
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

describe('image submit queue', () => {
  it('counts a running call and waits for it to finish', async () => {
    const id = randomUUID()

    await repo.saveImage(record(id))
    await queue.startImageSubmit(id)
    await gate.pending

    expect(queue.imageSendingCount()).toBe(1)
    expect(await queue.waitForImageSendingDone(20)).toBe(false)

    gate.release()

    await vi.waitFor(async () => {
      expect((await repo.getImage(id))?.status).toBe('completed')
    })

    await vi.waitFor(() => {
      expect(queue.imageSendingCount()).toBe(0)
    })
  })
})
