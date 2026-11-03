import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type {
  isDownloadQueued as IsDownloadQueued,
  queueDownload as QueueDownload,
} from '@/server/jobs/download-queue'
import type {
  getGeneration as GetGeneration,
  saveGeneration as SaveGeneration,
} from '@/server/repos/generations'

import type { GenerationRecord } from '../src/core/schemas/generation-record'

const root = path.join(os.tmpdir(), `cf-disk-full-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = root

const fetchVideoContent = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { fetchContent: fetchVideoContent }
    },
  }
})

const JOB = {
  status: 'completed' as const,
  generationId: null,
  expiresAt: 4_102_444_800_000,
  urls: null,
  usage: null,
  error: null,
}

const ID = '22222222-2222-4222-8222-222222222222'

let queueDownload: typeof QueueDownload
let isDownloadQueued: typeof IsDownloadQueued
let getGeneration: typeof GetGeneration
let saveGeneration: typeof SaveGeneration

beforeAll(async () => {
  await fs.mkdir(root, { recursive: true })

  ;({ queueDownload, isDownloadQueued } = await import('@/server/jobs/download-queue'))

  ;({ getGeneration, saveGeneration } = await import('@/server/repos/generations'))
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('download on a full disk', () => {
  it('keeps the record retryable and waits 60 s before the next try', async () => {
    fetchVideoContent.mockResolvedValue(diskFullResponse())

    const record = makeRecord()

    await saveGeneration(record)
    await queueDownload(record, JOB)

    const saved = await waitFor(async () => {
      const record = await getGeneration(ID)

      return record?.error?.startsWith('Disk is full') === true ? record : null
    })

    expect(saved.status).toBe('in_progress')
    expect(saved.download).toBeUndefined()
    expect(saved.error).toBe('Disk is full. Free some space, the download retries every minute.')
    expect(fetchVideoContent).toHaveBeenCalledTimes(1)

    await waitFor(async () => {
      return isDownloadQueued(ID) ? null : true
    })

    await queueDownload(saved, JOB)
    expect(fetchVideoContent).toHaveBeenCalledTimes(1)

    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000)

    await queueDownload(saved, JOB)
    spy.mockRestore()

    await waitFor(async () => {
      return fetchVideoContent.mock.calls.length === 2 ? true : null
    })

    expect(fetchVideoContent).toHaveBeenCalledTimes(2)
  })
})

/** A response whose body fails the write with ENOSPC. */
function diskFullResponse(): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.error(Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }))
    },
  })

  return new Response(stream, { status: 200 })
}

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await read()

    if (value) {
      return value
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  }

  throw new Error('Timed out waiting for the saved record')
}

function makeRecord(): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: ID,
    createdAt: now,
    updatedAt: now,
    status: 'in_progress',
    provider: 'openrouter',
    input: {
      presetId: 'wan-3.0',
      tab: 'frames',
      prompt: '',
      audio: false,
      duration: 5,
      aspectRatio: 'auto',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'wan-3.0', title: 'Wan 3.0', slug: 'alibaba/wan-3.0' },
    inputsSnapshot: {},
    job: { id: 'job-1', submittedAt: now },
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}
