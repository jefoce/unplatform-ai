/* eslint-disable max-lines -- route cases stay in one suite */

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { rememberExportFolder } from '@/server/services/export-tokens'

import type { ImageOutput, ImageRecord } from '../src/core/schemas/image-record'
import { required } from './helpers/required'

const ROOT = path.join(os.tmpdir(), `cf-image-outputs-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
    desktopMode: () => {
      return true
    },
    isDesktopMode: () => {
      return true
    },
  }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return {
    startImageSubmit: async () => {},
    cancelScheduledImageSubmit: () => {},
  }
})

interface ImagesRepo {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
  getImage: (id: string) => Promise<ImageRecord | null>
  listImages: () => Promise<ImageRecord[]>
  imageOutputFile: (output: ImageOutput) => string | null
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

interface OutputContext {
  params: Promise<{ id: string; 'output-id': string }>
}

interface OutputModule {
  PATCH: (request: Request, context: OutputContext) => Promise<Response>
  DELETE: (request: Request, context: OutputContext) => Promise<Response>
}

interface BatchModule {
  POST: (request: Request) => Promise<Response>
}

interface ExportModule {
  POST: (request: Request) => Promise<Response>
}

let repo: ImagesRepo
let files: ImageFiles
let outputRoute: OutputModule
let batchRoute: BatchModule
let exportRoute: ExportModule
let pngBytes = Buffer.from('')
let testIndex = 0

beforeAll(async () => {
  const sharp = (await import('@/server/media/sharp')).default

  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#2266ff' },
  })
    .png()
    .toBuffer()

  pngBytes = png
  repo = await import('@/server/repos/images')
  files = await import('@/server/services/image-files')
  outputRoute = await import('@/app/api/images/[id]/outputs/[output-id]/route')
  batchRoute = await import('@/app/api/images/batch/route')
  exportRoute = await import('@/app/api/images/export-batch/route')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })
  await fs.mkdir(path.join(ROOT, 'uploads'), { recursive: true })

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

function record(id: string, status: ImageRecord['status'] = 'completed'): ImageRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
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

async function withOutputs(
  count: number,
): Promise<{ record: ImageRecord; outputs: ImageOutput[] }> {
  const id = randomUUID()
  const saved = await repo.saveImage(record(id))
  const outputs: ImageOutput[] = []

  for (let index = 0; index < count; index += 1) {
    outputs.push(
      await files.writeImageOutput({
        recordId: id,
        outputId: randomUUID(),
        index,
        bytes: Uint8Array.from(pngBytes),
        mediaType: 'image/png',
      }),
    )
  }

  return { record: await repo.saveImage({ ...saved, outputs }), outputs }
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

function context(id: string, outputId: string): OutputContext {
  return { params: Promise.resolve({ id, 'output-id': outputId }) }
}

describe('PATCH and DELETE /api/images/[id]/outputs/[output-id]', () => {
  it('sets the favorite flag on one output', async () => {
    const { record: saved, outputs } = await withOutputs(1)
    const output = outputs[0]

    const response = await outputRoute.PATCH(
      request('PATCH', `http://127.0.0.1:3000/api/images/${saved.id}/outputs/${output?.id ?? ''}`, {
        favorite: true,
      }),
      context(saved.id, output?.id ?? ''),
    )

    expect(response.status).toBe(200)

    const stored = await repo.getImage(saved.id)

    expect(stored?.outputs[0]).toMatchObject({ favorite: true })
  })

  it('returns 404 when the output belongs to another record', async () => {
    const first = await withOutputs(1)
    const second = await withOutputs(1)
    const output = first.outputs[0]

    const response = await outputRoute.PATCH(
      request('PATCH', 'http://127.0.0.1:3000/api/images/x/outputs/y', { favorite: true }),
      context(second.record.id, output?.id ?? ''),
    )

    expect(response.status).toBe(404)
  })

  it('returns 404 for an unknown output', async () => {
    const { record: saved } = await withOutputs(1)

    const response = await outputRoute.PATCH(
      request('PATCH', 'http://127.0.0.1:3000/api/images/x/outputs/y', { favorite: true }),
      context(saved.id, randomUUID()),
    )

    expect(response.status).toBe(404)
  })

  it('removes one file and keeps the record', async () => {
    const { record: saved, outputs } = await withOutputs(2)
    const target = outputs[0]
    const file = target ? repo.imageOutputFile(target) : null

    const response = await outputRoute.DELETE(
      request('DELETE', 'http://127.0.0.1:3000/api/images/x/outputs/y'),
      context(saved.id, target?.id ?? ''),
    )

    expect(response.status).toBe(204)

    const stored = await repo.getImage(saved.id)

    expect(stored?.outputs).toHaveLength(1)

    expect(
      await fs.stat(file ?? '').catch(() => {
        return null
      }),
    ).toBeNull()
  })

  it('deletes the record with its last output', async () => {
    const { record: saved, outputs } = await withOutputs(1)

    const response = await outputRoute.DELETE(
      request('DELETE', 'http://127.0.0.1:3000/api/images/x/outputs/y'),
      context(saved.id, outputs[0]?.id ?? ''),
    )

    expect(response.status).toBe(204)
    expect(await repo.getImage(saved.id)).toBeNull()
  })

  it('refuses to remove an output while the record runs', async () => {
    const id = randomUUID()
    const saved = await repo.saveImage(record(id, 'submitting'))

    const output = {
      id: randomUUID(),
      index: 0,
      status: 'failed' as const,
      error: 'nope',
    }

    await repo.saveImage({ ...saved, outputs: [output] })

    const response = await outputRoute.DELETE(
      request('DELETE', 'http://127.0.0.1:3000/api/images/x/outputs/y'),
      context(id, output.id),
    )

    expect(response.status).toBe(409)
  })
})

describe('POST /api/images/batch', () => {
  it('favorites several outputs', async () => {
    const first = await withOutputs(1)
    const second = await withOutputs(1)
    const ids = [first.outputs[0]?.id ?? '', second.outputs[0]?.id ?? '']

    const outputs = [
      { recordId: first.record.id, outputId: ids[0] },
      { recordId: second.record.id, outputId: ids[1] },
    ]

    const response = await batchRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/batch', {
        action: 'favorite',
        outputs,
        favorite: true,
      }),
    )

    const body = (await response.json()) as { done: string[]; skipped: unknown[] }

    expect(body.done).toEqual(ids)
    expect(body.skipped).toEqual([])
  })

  it('deletes and skips missing outputs', async () => {
    const { record, outputs } = await withOutputs(1)
    const missing = randomUUID()
    const target = outputs[0]?.id ?? ''

    const response = await batchRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/batch', {
        action: 'delete',
        outputs: [
          { recordId: record.id, outputId: target },
          { recordId: record.id, outputId: missing },
        ],
      }),
    )

    const body = (await response.json()) as {
      done: string[]
      skipped: { id: string; reason: string }[]
    }

    expect(body.done).toEqual([target])
    expect(body.skipped).toEqual([{ id: missing, reason: 'not_found' }])
  })

  it('deletes a record when the output id is null', async () => {
    const id = randomUUID()

    await repo.saveImage(record(id, 'failed'))

    const response = await batchRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/batch', {
        action: 'delete',
        outputs: [{ recordId: id, outputId: null }],
      }),
    )

    const body = (await response.json()) as { done: string[]; skipped: unknown[] }

    expect(body.done).toEqual([id])
    expect(body.skipped).toEqual([])
    expect(await repo.getImage(id)).toBeNull()
  })
})

describe('POST /api/images/export-batch', () => {
  it('copies saved outputs into the chosen folder', async () => {
    const { record: saved, outputs } = await withOutputs(1)
    const dir = await fs.mkdtemp(path.join(ROOT, 'out-'))
    const output = required(outputs[0], 'saved output')

    rememberExportFolder(dir, 1)

    const response = await exportRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/export-batch', {
        outputs: [{ recordId: saved.id, outputId: output.id }],
        dir,
      }),
    )

    const body = (await response.json()) as { saved: string[]; skipped: unknown[] }

    expect(response.status).toBe(200)
    expect(body.saved).toHaveLength(1)
    expect(body.skipped).toEqual([])

    const file = required(body.saved[0], 'saved file')

    expect(path.extname(file)).toBe('.png')
    expect(await fs.readFile(file)).toEqual(pngBytes)
  })

  it('skips a failed output and rejects a relative folder', async () => {
    const { record: saved, outputs } = await withOutputs(1)
    const dir = await fs.mkdtemp(path.join(ROOT, 'out-'))
    const output = required(outputs[0], 'saved output')

    await repo.saveImage({
      ...saved,
      outputs: [{ id: output.id, index: 0, status: 'failed', error: 'Rejected' }],
    })

    rememberExportFolder(dir, 1)

    const response = await exportRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/export-batch', {
        outputs: [{ recordId: saved.id, outputId: output.id }],
        dir,
      }),
    )

    const body = (await response.json()) as { skipped: { id: string; reason: string }[] }

    expect(body.skipped).toEqual([{ id: output.id, reason: 'not_ready' }])

    const relative = await exportRoute.POST(
      request('POST', 'http://127.0.0.1:3000/api/images/export-batch', {
        outputs: [{ recordId: saved.id, outputId: output.id }],
        dir: 'images',
      }),
    )

    expect(relative.status).toBe(400)
  })
})
