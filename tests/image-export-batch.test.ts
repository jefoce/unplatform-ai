import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { rememberExportFolder } from '@/server/services/export-tokens'

import type { ImageRecord } from '../src/core/schemas/image-record'
import { required } from './helpers/required'

const root = await mkdtemp(path.join(os.tmpdir(), 'upai-image-export-'))

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

const { POST } = await import('@/app/api/images/export-batch/route')

const images = path.join(root, 'images')
const imageBytes = Buffer.from('fake-png-bytes')

function record(id: string, outputId: string, prompt = 'A cat'): ImageRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Gemini', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt,
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

async function write(item: ImageRecord): Promise<void> {
  await writeFile(path.join(images, `${item.id}.json`), JSON.stringify(item))

  const output = required(item.outputs[0], 'image output')

  if (output.status === 'saved') {
    await writeFile(path.join(images, output.file), imageBytes)
  }
}

const item = record(randomUUID(), randomUUID(), 'A cat!')

const outputId = required(item.outputs[0], 'image output').id

const exportRequest = (body: unknown): Request => {
  return new Request('http://127.0.0.1:3000/api/images/export-batch', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

async function grantedDir(): Promise<string> {
  const dir = await mkdtemp(path.join(root, 'out-'))

  rememberExportFolder(dir, 1)

  return dir
}

beforeAll(async () => {
  await mkdir(images, { recursive: true })
  await write(item)
})

describe('POST /api/images/export-batch', () => {
  beforeEach(() => {
    session.required = true
    session.desktop = true
  })

  it('copies images into the folder', async () => {
    const dir = await grantedDir()
    const response = await POST(exportRequest({ outputs: [{ recordId: item.id, outputId }], dir }))
    const body = (await response.json()) as { saved: string[]; skipped: unknown[] }

    expect(response.status).toBe(200)
    expect(body.saved).toHaveLength(1)

    const saved = required(body.saved[0], 'saved file')

    expect(path.basename(saved)).toBe(`a-cat-${outputId.slice(0, 6)}.png`)
    expect(await readFile(saved)).toEqual(imageBytes)
    expect(body.skipped).toEqual([])
  })

  it('reports a missing output with the same skipped shape', async () => {
    const dir = await grantedDir()
    const missing = randomUUID()

    const response = await POST(
      exportRequest({ outputs: [{ recordId: missing, outputId: missing }], dir }),
    )

    const body = (await response.json()) as { saved: string[]; skipped: { reason: string }[] }

    expect(response.status).toBe(200)
    expect(body.saved).toEqual([])
    expect(body.skipped).toEqual([{ id: missing, reason: 'not_found' }])
  })

  it('403s without a folder grant', async () => {
    const dir = await mkdtemp(path.join(root, 'out-'))
    const response = await POST(exportRequest({ outputs: [{ recordId: item.id, outputId }], dir }))

    expect(response.status).toBe(403)
    expect(await readdir(dir)).toEqual([])
  })
})
