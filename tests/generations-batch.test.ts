import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'

const root = await mkdtemp(path.join(os.tmpdir(), 'upai-batch-'))

process.env.STORAGE_ROOT = root
delete process.env.APP_TOKEN

const { POST } = await import('@/app/api/generations/batch/route')

const downloads = path.join(root, 'downloads')

function record(
  id: string,
  status: GenerationRecord['status'],
  extra: Partial<GenerationRecord> = {},
): GenerationRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: 'A cat',
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: `${id}.mp4` },
    ...extra,
  }
}

async function write(record: GenerationRecord): Promise<void> {
  await writeFile(path.join(downloads, `${record.id}.json`), JSON.stringify(record))
  await writeFile(path.join(downloads, `${record.id}.mp4`), 'video')
}

const batchRequest = (body: unknown): Request => {
  return new Request('http://127.0.0.1:3000/api/generations/batch', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  await mkdir(downloads, { recursive: true })
})

describe('POST /api/generations/batch', () => {
  it('favorites many records', async () => {
    const first = record(randomUUID(), 'completed')
    const second = record(randomUUID(), 'completed')

    await write(first)
    await write(second)

    const response = await POST(
      batchRequest({ action: 'favorite', ids: [first.id, second.id], favorite: true }),
    )

    const body = (await response.json()) as { done: string[]; skipped: unknown[] }

    expect(response.status).toBe(200)
    expect(body.done).toEqual([first.id, second.id])
    expect(body.skipped).toEqual([])
    const saved = JSON.parse(await readFile(path.join(downloads, `${first.id}.json`), 'utf8'))

    expect(saved.favorite).toBe(true)
  })

  it('deletes finished records and skips active ones', async () => {
    const done = record(randomUUID(), 'completed')
    const active = record(randomUUID(), 'in_progress')

    await write(done)
    await write(active)

    const response = await POST(batchRequest({ action: 'delete', ids: [done.id, active.id] }))

    const body = (await response.json()) as {
      done: string[]
      skipped: { id: string; reason: string }[]
    }

    expect(body.done).toEqual([done.id])
    expect(body.skipped).toEqual([{ id: active.id, reason: 'active' }])
    await expect(stat(path.join(downloads, `${done.id}.json`))).rejects.toThrow()
    expect((await stat(path.join(downloads, `${active.id}.json`))).isFile()).toBe(true)
  })

  it('cancels and deletes a record still in grace', async () => {
    const grace = record(randomUUID(), 'submitting', {
      submit: { stage: 'grace', notBefore: new Date(Date.now() + 60_000).toISOString() },
    })

    await write(grace)

    const response = await POST(batchRequest({ action: 'delete', ids: [grace.id] }))
    const body = (await response.json()) as { done: string[] }

    expect(body.done).toEqual([grace.id])
    await expect(stat(path.join(downloads, `${grace.id}.json`))).rejects.toThrow()
  })

  it('rejects invalid ids', async () => {
    const response = await POST(batchRequest({ action: 'delete', ids: ['not-a-uuid'] }))

    expect(response.status).toBe(400)
  })

  it('rejects more than 200 ids', async () => {
    const ids = Array.from({ length: 201 }, () => {
      return randomUUID()
    })

    const response = await POST(batchRequest({ action: 'delete', ids }))

    expect(response.status).toBe(400)
  })

  it('requires favorite for the favorite action', async () => {
    const id = randomUUID()
    const response = await POST(batchRequest({ action: 'favorite', ids: [id] }))

    expect(response.status).toBe(400)
  })
})
