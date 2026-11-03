import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CallOutcome } from '@/server/jobs/image-calls'
import type { ImageResultItem } from '@/server/providers/types'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-save-stage-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const saveGate = vi.hoisted(() => {
  const entered = Promise.withResolvers<void>()
  const opened = Promise.withResolvers<void>()

  return {
    enter: entered.resolve,
    pending: entered.promise,
    release: opened.resolve,
    opened: opened.promise,
  }
})

interface FinishGate {
  enter: () => void
  pending: Promise<void>
  release: () => void
  opened: Promise<void>
}

function createFinishGate(): FinishGate {
  const entered = Promise.withResolvers<void>()
  const opened = Promise.withResolvers<void>()

  return {
    enter: entered.resolve,
    pending: entered.promise,
    release: opened.resolve,
    opened: opened.promise,
  }
}

const finishControl = vi.hoisted(() => {
  return { create: createFinishGate, current: createFinishGate() }
})

const control = vi.hoisted(() => {
  return { item: null as ImageResultItem | null }
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
          return { items: [control.item], costUsd: 0 }
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

interface OutputsModule {
  saveOutcome: (params: {
    record: ImageRecord
    outcome: CallOutcome
    resolved: CallOutcome[]
  }) => Promise<void>
  finishImage: (params: { id: string; resolved: CallOutcome[] }) => Promise<void>
}

vi.mock('@/server/jobs/image-outputs', async () => {
  const actual = await vi.importActual<OutputsModule>('@/server/jobs/image-outputs')

  return {
    ...actual,
    saveOutcome: async (params: {
      record: ImageRecord
      outcome: CallOutcome
      resolved: CallOutcome[]
    }) => {
      saveGate.enter()
      await saveGate.opened

      return actual.saveOutcome(params)
    },
    finishImage: async (params: { id: string; resolved: CallOutcome[] }) => {
      const gate = finishControl.current

      gate.enter()
      await gate.opened

      return actual.finishImage(params)
    },
  }
})

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
}

interface RunModule {
  runImageSubmit: (id: string) => Promise<'done' | 'requeue'>
}

interface QueueModule {
  imageSendingCount: () => number
  waitForImageSendingDone: (timeoutMs: number) => Promise<boolean>
}

let repo: ImagesRepo
let runner: RunModule
let queue: QueueModule
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#ff8844' },
  })
    .png()
    .toBuffer()

  control.item = { b64: png.toString('base64'), mediaType: 'image/png' }
  repo = await import('@/server/repos/images')
  runner = await import('@/server/jobs/image-run')
  queue = await import('@/server/jobs/image-submit-queue')
})

beforeEach(async () => {
  finishControl.current = finishControl.create()
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
})

afterEach(() => {
  saveGate.release()
  finishControl.current.release()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(): ImageRecord {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
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
    outputs: [{ id: randomUUID(), index: 0, status: 'pending' }],
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

describe('image save stage', () => {
  it('keeps the sending stage until saveOutcome resolves', async () => {
    const saved = await repo.saveImage(record())
    const run = runner.runImageSubmit(saved.id)

    await saveGate.pending

    expect((await repo.getImage(saved.id))?.status).toBe('saving')
    expect(queue.imageSendingCount()).toBe(1)
    expect(await queue.waitForImageSendingDone(20)).toBe(false)

    saveGate.release()
    finishControl.current.release()
    await run

    expect(queue.imageSendingCount()).toBe(0)
    expect((await repo.getImage(saved.id))?.status).toBe('completed')
  })

  it('keeps the stage set until finishImage resolves', async () => {
    saveGate.release()
    const saved = await repo.saveImage(record())
    const run = runner.runImageSubmit(saved.id)

    await finishControl.current.pending

    expect(queue.imageSendingCount()).toBe(1)
    expect(await queue.waitForImageSendingDone(20)).toBe(false)

    finishControl.current.release()
    await run

    expect(queue.imageSendingCount()).toBe(0)
    expect((await repo.getImage(saved.id))?.status).toBe('completed')
  })
})
