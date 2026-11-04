/* eslint-disable max-lines -- route cases stay in one suite */

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as LivePricingModule from '@/server/pricing/live'

import { IMAGE_MAX_ACTIVE } from '../src/core/constants'
import { type ImageOutput, type ImageRecord, isImageActive } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-images-routes-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const startImageSubmit = vi.hoisted(() => {
  return vi.fn(async () => {})
})

const pricingGate = vi.hoisted(() => {
  const gate = Promise.withResolvers<void>()

  return { isGated: false, calls: 0, wait: gate.promise, open: gate.resolve }
})

const catalog = vi.hoisted(() => {
  return { missingPresetId: null as string | null }
})

vi.mock('@/server/services/model-catalog', () => {
  return {
    getModelCatalog: async () => {
      const entries =
        catalog.missingPresetId === null
          ? []
          : [
              {
                presetId: catalog.missingPresetId,
                modelId: 'missing-model',
                provider: 'openrouter',
                pricing: { skus: {}, listSkus: {}, discount: 0, source: 'fallback', fetchedAt: '' },
                status: 'missing',
                reason: 'Not available on OpenRouter right now.',
              },
            ]

      return { entries, fetchedAt: '2026-01-01T00:00:00.000Z' }
    },
  }
})

vi.mock('@/server/pricing/live', async (importOriginal) => {
  const actual = await importOriginal<typeof LivePricingModule>()

  return {
    ...actual,
    loadLivePricing: async (params: Parameters<typeof actual.loadLivePricing>[0]) => {
      pricingGate.calls += 1

      if (pricingGate.isGated && pricingGate.calls === 1) {
        await pricingGate.wait
      }

      return actual.fallbackPricing(params.fallback)
    },
  }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const getSecret = vi.hoisted(() => {
  return vi.fn((name: string) => {
    return name === 'OPENROUTER_API_KEY' ? 'test-key' : null
  })
})

vi.mock('@/server/secrets', () => {
  return { getSecret, secretsReady: async () => {} }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return {
    startImageSubmit,
    cancelScheduledImageSubmit: () => {},
  }
})

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
}

interface ImageFiles {
  writeImageOutput: (params: {
    recordId: string
    outputId: string
    index: number
    bytes: Uint8Array
    mediaType: 'image/png'
  }) => Promise<ImageOutput>
}

interface ListModule {
  GET: (request: Request) => Promise<Response>
  POST: (request: Request) => Promise<Response>
}

interface IdContext {
  params: Promise<{ id: string }>
}

interface IdModule {
  GET: (request: Request, context: IdContext) => Promise<Response>
  DELETE: (request: Request, context: IdContext) => Promise<Response>
}

interface FrameContext {
  params: Promise<{ id: string; 'output-id': string }>
}

interface FrameModule {
  POST: (request: Request, context: FrameContext) => Promise<Response>
}

let repo: ImagesRepo
let files: ImageFiles
let listRoute: ListModule
let idRoute: IdModule
let frameRoute: FrameModule
let pngBytes = Buffer.from('')
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#ff8800' },
  })
    .png()
    .toBuffer()

  pngBytes = png
  repo = await import('@/server/repos/images')
  files = await import('@/server/services/image-files')
  listRoute = await import('@/app/api/images/route')
  idRoute = await import('@/app/api/images/[id]/route')
  frameRoute = await import('@/app/api/images/[id]/outputs/[output-id]/frame/route')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
  await fs.mkdir(path.join(ROOT, 'uploads'), { recursive: true })

  testIndex += 1
  const stamp = new Date(Date.now() + testIndex * 1000)

  await fs.utimes(IMAGES, stamp, stamp)
  await repo.listImages()
  startImageSubmit.mockClear()
  pricingGate.isGated = false
  pricingGate.calls = 0
  catalog.missingPresetId = null

  getSecret.mockImplementation((name: string) => {
    return name === 'OPENROUTER_API_KEY' ? 'test-key' : null
  })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function record(params: {
  id?: string
  status?: ImageRecord['status']
  favorite?: boolean
  createdAt?: string
  output?: ImageOutput
}): ImageRecord {
  const id = params.id ?? randomUUID()
  const createdAt = params.createdAt ?? '2026-01-01T00:00:00.000Z'
  const outputs = params.output ? [params.output] : []

  return {
    id,
    createdAt,
    updatedAt: createdAt,
    status: params.status ?? 'completed',
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
      priceSource: 'unknown',
      billed: null,
    },
  }
}

function savedOutput(id: string, isFavorite = false): ImageOutput {
  return {
    id: randomUUID(),
    index: 0,
    status: 'saved',
    file: `${id}-0.png`,
    mediaType: 'image/png',
    width: 4,
    height: 4,
    bytes: pngBytes.length,
    favorite: isFavorite,
    seed: null,
  }
}

function request(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const submitBody = {
  presetId: 'gemini-3.1-flash-image',
  prompt: 'a cat',
  count: 1,
  aspectRatio: '1:1',
  resolution: '1K',
  quality: null,
  background: null,
  references: [],
  seed: null,
}

describe('GET /api/images', () => {
  it('lists records and filters by output favorite', async () => {
    await repo.saveImage(record({ output: savedOutput(randomUUID(), true) }))
    await repo.saveImage(record({ output: savedOutput(randomUUID()) }))

    const response = await listRoute.GET(request('GET', 'http://127.0.0.1:3000/api/images'))
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect((body as { items: unknown[] }).items).toHaveLength(2)

    const liked = await listRoute.GET(request('GET', 'http://127.0.0.1:3000/api/images?favorite=1'))
    const likedBody = (await liked.json()) as { items: ImageRecord[] }

    expect(likedBody.items).toHaveLength(1)
  })

  it('returns the global active count on a filtered page', async () => {
    await repo.saveImage(record({ status: 'saving' }))
    await repo.saveImage(record({ output: savedOutput(randomUUID(), true) }))

    const response = await listRoute.GET(
      request('GET', 'http://127.0.0.1:3000/api/images?favorite=1'),
    )

    const body = (await response.json()) as { items: ImageRecord[]; activeCount: number }

    expect(body.items).toHaveLength(1)
    expect(body.activeCount).toBe(1)
  })

  it('returns only active images without a cursor when active is set', async () => {
    for (let index = 0; index <= IMAGE_MAX_ACTIVE; index += 1) {
      await repo.saveImage(record({ status: index % 2 === 0 ? 'submitting' : 'saving' }))
    }

    await repo.saveImage(record({ status: 'completed' }))

    const response = await listRoute.GET(
      request('GET', 'http://127.0.0.1:3000/api/images?active=1&limit=1'),
    )

    const body = (await response.json()) as {
      items: ImageRecord[]
      nextCursor: string | null
      activeCount: number
    }

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(IMAGE_MAX_ACTIVE)
    expect(body.items.every(isImageActive)).toBe(true)
    expect(body.nextCursor).toBeNull()
    expect(body.activeCount).toBe(IMAGE_MAX_ACTIVE + 1)
  })

  it('pages with a cursor', async () => {
    await repo.saveImage(record({ createdAt: '2026-01-01T00:00:00.000Z' }))
    await repo.saveImage(record({ createdAt: '2026-01-02T00:00:00.000Z' }))

    const first = await listRoute.GET(request('GET', 'http://127.0.0.1:3000/api/images?limit=1'))
    const firstBody = (await first.json()) as { items: ImageRecord[]; nextCursor: string | null }

    expect(firstBody.items).toHaveLength(1)
    expect(firstBody.nextCursor).not.toBeNull()

    const next = await listRoute.GET(
      request(
        'GET',
        `http://127.0.0.1:3000/api/images?limit=1&cursor=${encodeURIComponent(firstBody.nextCursor ?? '')}`,
      ),
    )

    const nextBody = (await next.json()) as { items: ImageRecord[] }

    expect(nextBody.items).toHaveLength(1)
    expect(nextBody.items[0]?.id).not.toBe(firstBody.items[0]?.id)
  })
})

describe('POST /api/images', () => {
  it('returns 400 before creating a record when the key is missing', async () => {
    getSecret.mockReturnValue(null)

    const before = await repo.listImages()

    const response = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', submitBody),
    )

    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe('OpenRouter key is not set')
    expect((await repo.listImages()).length).toBe(before.length)
  })

  it('creates a submitting record with one pending id per output and queues it', async () => {
    const response = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', { ...submitBody, count: 2 }),
    )

    const body = (await response.json()) as ImageRecord

    expect(response.status).toBe(201)
    expect(body.status).toBe('submitting')

    expect(
      body.outputs.map((output) => {
        return output.status
      }),
    ).toEqual(['pending', 'pending'])

    expect(
      body.outputs.map((output) => {
        return output.index
      }),
    ).toEqual([0, 1])

    expect(
      new Set(
        body.outputs.map((output) => {
          return output.id
        }),
      ).size,
    ).toBe(2)

    expect(
      body.outputs.every((output) => {
        return /^[0-9a-f-]{36}$/.test(output.id)
      }),
    ).toBe(true)

    expect(await repo.getImage(body.id)).not.toBeNull()
    expect(startImageSubmit).toHaveBeenCalledWith(body.id)
  })

  it('refuses a new image while the active cap is reached', async () => {
    for (let index = 0; index < IMAGE_MAX_ACTIVE; index += 1) {
      await repo.saveImage(record({ status: 'submitting' }))
    }

    const response = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', submitBody),
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('content-type')).toContain('application/json')

    expect(await response.json()).toEqual({
      error: `${IMAGE_MAX_ACTIVE} images already generating. Wait for one to finish.`,
    })

    expect(startImageSubmit).not.toHaveBeenCalled()
  })

  it('refuses a catalog-missing model before writing a record', async () => {
    catalog.missingPresetId = submitBody.presetId

    const before = await repo.listImages()

    const response = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', submitBody),
    )

    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe('Not available on OpenRouter right now.')
    expect((await repo.listImages()).length).toBe(before.length)
  })

  it('rejects an unknown preset and an unsupported control', async () => {
    const unknown = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', { ...submitBody, presetId: 'missing' }),
    )

    expect(unknown.status).toBe(400)

    const wrongResolution = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', { ...submitBody, resolution: '768' }),
    )

    expect(wrongResolution.status).toBe(400)
  })
})

describe('POST /api/images pricing', () => {
  it('prices a create before the active cap lock', async () => {
    pricingGate.isGated = true

    const first = listRoute.POST(request('POST', 'http://127.0.0.1:3000/api/images', submitBody))

    await vi.waitFor(() => {
      expect(pricingGate.calls).toBe(1)
    })

    const second = await listRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images', submitBody),
    )

    expect(second.status).toBe(201)
    expect(pricingGate.calls).toBe(2)

    pricingGate.open()

    expect((await first).status).toBe(201)
  })
})

describe('GET and DELETE /api/images/[id]', () => {
  it('reads a record and deletes it', async () => {
    const saved = await repo.saveImage(record({}))

    const read = await idRoute.GET(request('GET', `http://127.0.0.1:3000/api/images/${saved.id}`), {
      params: Promise.resolve({ id: saved.id }),
    })

    expect(read.status).toBe(200)

    const removed = await idRoute.DELETE(
      request('DELETE', `http://127.0.0.1:3000/api/images/${saved.id}`),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(removed.status).toBe(204)
    expect(await repo.getImage(saved.id)).toBeNull()
  })

  it('refuses to delete a running record', async () => {
    const saved = await repo.saveImage(record({ status: 'submitting' }))

    const response = await idRoute.DELETE(
      request('DELETE', `http://127.0.0.1:3000/api/images/${saved.id}`),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(response.status).toBe(409)
  })
})

describe('POST /api/images/[id]/outputs/[output-id]/frame', () => {
  it('copies a saved output into uploads that survives deleting the output', async () => {
    const saved = await repo.saveImage(record({ status: 'saving' }))

    const output = await files.writeImageOutput({
      recordId: saved.id,
      outputId: randomUUID(),
      index: 0,
      bytes: Uint8Array.from(pngBytes),
      mediaType: 'image/png',
    })

    await repo.saveImage({ ...saved, status: 'completed', outputs: [output] })

    const response = await frameRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${saved.id}/outputs/${output.id}/frame`),
      { params: Promise.resolve({ id: saved.id, 'output-id': output.id }) },
    )

    const item = (await response.json()) as {
      id: string
      kind: string
      source: string
      linkMode?: string
      target?: string
    }

    expect(response.status).toBe(201)
    expect(item.kind).toBe('image')
    expect(item.source).toBe('file')
    expect(item.linkMode).toBeUndefined()
    expect(item.target).toBeUndefined()

    const removed = await idRoute.DELETE(
      request('DELETE', `http://127.0.0.1:3000/api/images/${saved.id}`),
      { params: Promise.resolve({ id: saved.id }) },
    )

    expect(removed.status).toBe(204)

    const uploads = await import('@/server/repos/uploads')
    const upload = await uploads.getUpload(item.id)

    expect(upload?.missing).toBe(false)
  })

  it('returns 409 for a failed output', async () => {
    const saved = await repo.saveImage(record({}))

    const failed: ImageOutput = {
      id: randomUUID(),
      index: 0,
      status: 'failed',
      error: 'nope',
    }

    await repo.saveImage({ ...saved, outputs: [failed] })

    const response = await frameRoute.POST(
      request('POST', `http://127.0.0.1:3000/api/images/${saved.id}/outputs/${failed.id}/frame`),
      { params: Promise.resolve({ id: saved.id, 'output-id': failed.id }) },
    )

    expect(response.status).toBe(409)
  })
})
