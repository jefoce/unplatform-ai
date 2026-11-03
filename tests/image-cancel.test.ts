import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-cancel-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const cancelScheduledImageSubmit = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return { cancelScheduledImageSubmit }
})

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
}

interface ImageActions {
  cancelImage: (id: string) => Promise<'cancelled' | 'not_grace' | 'not_found'>
}

interface IdContext {
  params: Promise<{ id: string }>
}

interface CancelModule {
  POST: (request: Request, context: IdContext) => Promise<Response>
}

let repo: ImagesRepo
let actions: ImageActions
let cancelRoute: CancelModule

beforeAll(async () => {
  repo = await import('@/server/repos/images')
  actions = await import('@/server/services/image-actions')
  cancelRoute = await import('@/app/api/images/[id]/cancel/route')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
  await repo.listImages()
  cancelScheduledImageSubmit.mockClear()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

interface RecordParams {
  id?: string
  status?: ImageRecord['status']
  submit?: ImageRecord['submit']
}

function record(params: RecordParams = {}): ImageRecord {
  const id = params.id ?? randomUUID()

  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: params.status ?? 'submitting',
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
    ...(params.submit === undefined ? {} : { submit: params.submit }),
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

function graceRecord(): ImageRecord {
  return record({ submit: { stage: 'grace', notBefore: '2026-01-01T00:00:10.000Z' } })
}

function request(method: string, url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: {
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
  })
}

describe('cancelImage service', () => {
  it('deletes a grace record and its files', async () => {
    const saved = await repo.saveImage(graceRecord())

    const result = await actions.cancelImage(saved.id)

    expect(result).toBe('cancelled')
    expect(cancelScheduledImageSubmit).toHaveBeenCalledWith(saved.id)
    expect(await repo.getImage(saved.id)).toBeNull()
  })

  it('refuses a record that left grace', async () => {
    const saved = await repo.saveImage(record({ submit: { stage: 'sending' } }))

    expect(await actions.cancelImage(saved.id)).toBe('not_grace')
    expect(cancelScheduledImageSubmit).not.toHaveBeenCalled()
    expect(await repo.getImage(saved.id)).not.toBeNull()
  })

  it('returns not_found for a missing record', async () => {
    expect(await actions.cancelImage(randomUUID())).toBe('not_found')
  })
})

describe('POST /api/images/[id]/cancel', () => {
  it('cancels a grace record', async () => {
    const saved = await repo.saveImage(graceRecord())

    const response = await cancelRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${saved.id}/cancel`),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(response.status).toBe(204)
    expect(await repo.getImage(saved.id)).toBeNull()
  })

  it('returns 409 after grace', async () => {
    const saved = await repo.saveImage(record({ status: 'saving' }))

    const response = await cancelRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${saved.id}/cancel`),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'Already sent, cannot cancel' })
  })

  it('returns 404 for a missing record', async () => {
    const id = randomUUID()

    const response = await cancelRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${id}/cancel`),
      { params: Promise.resolve({ id }) },
    )

    expect(response.status).toBe(404)
  })

  it('rejects a cross-site request', async () => {
    const saved = await repo.saveImage(graceRecord())

    const response = await cancelRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${saved.id}/cancel`, {
        'sec-fetch-site': 'cross-site',
      }),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(response.status).toBe(403)
    expect(await repo.getImage(saved.id)).not.toBeNull()
  })
})
