import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { rememberExportPath } from '@/server/services/export-tokens'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { required } from './helpers/required'

const root = await mkdtemp(path.join(os.tmpdir(), 'upai-image-export-one-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const session = vi.hoisted(() => {
  return { required: true, desktop: true }
})

vi.mock('@/server/session', () => {
  return {
    desktopMode: () => {
      return session.required
    },
    isDesktopMode: () => {
      return session.desktop
    },
    hasSession: () => {
      return true
    },
  }
})

const { POST } = await import('@/app/api/images/[id]/outputs/[output-id]/export/route')

const images = path.join(root, 'images')
const imageBytes = Buffer.from('fake-png-bytes')
const id = randomUUID()
const outputId = randomUUID()

function record(): ImageRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Gemini', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'A cat',
      count: 1,
      aspectRatio: '16:9',
      resolution: null,
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [
      {
        id: outputId,
        index: 0,
        status: 'saved',
        file: `${id}-0.png`,
        mediaType: 'image/png',
        width: 1024,
        height: 1024,
        bytes: imageBytes.length,
        favorite: false,
        seed: null,
      },
    ],
    seedUsed: 1,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: 0,
      priceSource: 'mock',
      billed: true,
    },
  }
}

const item = record()

const exportRequest = (body: unknown): Request => {
  return new Request(`http://127.0.0.1:3000/api/images/${id}/outputs/${outputId}/export`, {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

const context = (recordId = id, imageOutputId = outputId) => {
  return { params: Promise.resolve({ id: recordId, 'output-id': imageOutputId }) }
}

beforeAll(async () => {
  await mkdir(images, { recursive: true })
  await writeFile(path.join(images, `${id}.json`), JSON.stringify(item))

  const output = required(item.outputs[0], 'image output')

  if (output.status === 'saved') {
    await writeFile(path.join(images, output.file), imageBytes)
  }
})

describe('POST /api/images/[id]/outputs/[output-id]/export', () => {
  beforeEach(() => {
    session.required = true
    session.desktop = true
  })

  it('copies the image to the target', async () => {
    const target = path.join(root, 'one.png')

    rememberExportPath(target)
    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(201)
    expect(await readFile(target)).toEqual(imageBytes)
  })

  it('rejects a target that is not an image', async () => {
    const response = await POST(exportRequest({ path: path.join(root, 'one.gif') }), context())

    expect(response.status).toBe(400)
  })

  it('rejects a target with another extension', async () => {
    const response = await POST(exportRequest({ path: path.join(root, 'one.jpg') }), context())

    expect(response.status).toBe(400)
  })

  it('rejects relative paths', async () => {
    const response = await POST(exportRequest({ path: 'one.png' }), context())

    expect(response.status).toBe(400)
  })

  it('404s for a missing output', async () => {
    const missing = randomUUID()

    const response = await POST(
      exportRequest({ path: path.join(root, 'missing.png') }),
      context(id, missing),
    )

    expect(response.status).toBe(404)
  })

  it('403s when the same target is used twice', async () => {
    const target = path.join(root, 'twice.png')

    rememberExportPath(target)

    const first = await POST(exportRequest({ path: target }), context())
    const second = await POST(exportRequest({ path: target }), context())

    expect(first.status).toBe(201)
    expect(second.status).toBe(403)
  })

  it('rejects a target that is a directory', async () => {
    const target = path.join(root, 'folder.png')

    await mkdir(target)
    rememberExportPath(target)

    const response = await POST(exportRequest({ path: target }), context())

    expect(response.status).toBe(400)
  })
})
