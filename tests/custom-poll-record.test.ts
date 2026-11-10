/* eslint-disable max-lines -- poll cases share one fixture setup */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { ProviderError } from '@/server/providers/provider-error'
import type { JobSnapshot } from '@/server/providers/types'

import { storedRecord } from './helpers/stored-record'

const ROOT = path.join(os.tmpdir(), `cf-custom-poll-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const mocks = vi.hoisted(() => {
  return {
    getJob: vi.fn<(ref: { jobId: string }) => Promise<JobSnapshot>>(),
    endpoints: new Set<string>(['ep1']),
    recordHealthOk: vi.fn(),
    recordHealthFromError: vi.fn(),
    isOffline: false,
    queueDownload: vi.fn(),
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { getJob: mocks.getJob }
    },
  }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return mocks.endpoints.has(id) ? { id } : null
    },
  }
})

vi.mock('@/server/services/endpoint-health', () => {
  return {
    recordHealthOk: mocks.recordHealthOk,
    recordHealthFromError: (params: unknown) => {
      mocks.recordHealthFromError(params)

      return mocks.isOffline
    },
    shortErrorText: () => {
      return 'Endpoint unreachable'
    },
  }
})

vi.mock('@/server/jobs/download-queue', () => {
  return { queueDownload: mocks.queueDownload }
})

interface SaveModule {
  saveGeneration: (record: GenerationRecord) => Promise<GenerationRecord>
  getGeneration: (id: string) => Promise<GenerationRecord | null>
}

let repo: SaveModule
let processRecord: (record: GenerationRecord) => Promise<void>

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })

  repo = await import('@/server/repos/generations')
  processRecord = (await import('@/server/jobs/poll-record')).processRecord
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

beforeEach(() => {
  mocks.getJob.mockReset()
  mocks.recordHealthOk.mockReset()
  mocks.recordHealthFromError.mockReset()
  mocks.queueDownload.mockReset()
  mocks.isOffline = false
  mocks.endpoints.clear()
  mocks.endpoints.add('ep1')
})

const SOURCE = {
  kind: 'custom' as const,
  instanceId: 'ep1',
  badge: 'CU1',
  presetTitle: 'Local Wan',
  workflowName: null,
  endpointLabel: 'Local',
  local: true,
}

function customRecord(id: string, estimatedUsd: number): GenerationRecord {
  return storedRecord(id, {
    provider: 'custom',
    status: 'in_progress',
    source: SOURCE,
    input: {
      ...storedRecord(id).input,
      presetId: 'custom.ep1.wan22',
    },
    preset: { id: 'custom.ep1.wan22', title: 'Local Wan', slug: 'wan22' },
    job: { id: 'job-1', submittedAt: '2026-01-01T00:00:00.000Z' },
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'fallback',
      estimatedUsd,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  })
}

function snapshot(overrides: Partial<JobSnapshot>): JobSnapshot {
  return {
    status: 'failed',
    generationId: null,
    expiresAt: null,
    urls: null,
    usage: null,
    error: 'boom',
    ...overrides,
  }
}

describe('custom record completion cost', () => {
  it('uses the job usage cost when the pack reports one', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const record = customRecord(id, 0.2)

    mocks.getJob.mockResolvedValue(
      snapshot({
        usage: { costUsd: 0.5, isByok: false, usesEstimatedCost: false },
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.cost.actualUsd).toBe(0.5)
    expect(saved?.cost.billed).toBe(true)
    expect(mocks.recordHealthOk).toHaveBeenCalledWith('ep1')
  })

  it('falls back to the resolved price and never leaves actualUsd null', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const record = customRecord(id, 0)

    mocks.getJob.mockResolvedValue(snapshot({}))

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.cost.actualUsd).toBe(0)
    expect(saved?.cost.billed).toBe(false)
  })

  it('treats a reported zero cost as unreported for a custom completion', async () => {
    const id = '55555555-5555-4555-8555-555555555555'
    const record = customRecord(id, 2.5)

    mocks.getJob.mockResolvedValue(
      snapshot({
        status: 'completed',
        usage: { costUsd: 0, isByok: false, usesEstimatedCost: false },
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.cost.actualUsd).toBe(2.5)
    expect(saved?.cost.billed).toBe(true)
  })

  it('records a health failure from a rejected poll', async () => {
    const { ProviderError } = await import('@/server/providers/provider-error')
    const id = '33333333-3333-4333-8333-333333333333'
    const record = customRecord(id, 0)

    mocks.getJob.mockRejectedValue(
      new ProviderError({
        providerId: 'custom',
        kind: 'auth',
        message: 'upai:unauthorized: invalid bearer token',
        storedMessage: 'upai:unauthorized: invalid bearer token',
        status: 401,
        code: 'unauthorized',
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    expect(mocks.recordHealthFromError).toHaveBeenCalledWith({
      endpointId: 'ep1',
      error: expect.anything(),
      source: 'job',
      isJobRunning: true,
    })
  })
})

describe('transient offline poll errors', () => {
  it('leaves the record unchanged after one failed poll', async () => {
    const id = '88888888-8888-4888-8888-888888888888'
    const record = customRecord(id, 0)

    mocks.getJob.mockRejectedValue(new TypeError('fetch failed'))
    mocks.isOffline = false

    await repo.saveGeneration(record)
    await expect(processRecord(record)).rejects.toThrow('fetch failed')

    const saved = await repo.getGeneration(id)

    expect(saved?.status).toBe('in_progress')
    expect(saved?.error).toBeUndefined()
  })

  it('writes the transient offline error once the helper reports offline', async () => {
    const id = '99999999-9999-4999-8999-999999999999'
    const record = customRecord(id, 0)

    mocks.getJob.mockRejectedValue(new TypeError('fetch failed'))
    mocks.isOffline = true

    await repo.saveGeneration(record)
    await expect(processRecord(record)).rejects.toThrow('fetch failed')

    const saved = await repo.getGeneration(id)

    expect(saved?.status).toBe('in_progress')
    expect(saved?.error).toBe('upai:comfy_unavailable: Endpoint unreachable')
  })

  it('clears the transient offline error on the next good poll', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    const record = {
      ...customRecord(id, 0),
      createdAt: new Date().toISOString(),
      error: 'upai:comfy_unavailable: Endpoint unreachable',
    }

    mocks.getJob.mockResolvedValue(snapshot({ status: 'in_progress', error: null }))

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.status).toBe('in_progress')
    expect(saved?.error).toBeUndefined()
  })
})

describe('auth error text', () => {
  it('stores the text once when both parts are equal', async () => {
    const id = '66666666-6666-4666-8666-666666666666'
    const record = customRecord(id, 0)

    mocks.getJob.mockRejectedValue(
      new ProviderError({
        providerId: 'custom',
        kind: 'auth',
        message: 'upai:unauthorized: invalid bearer token',
        storedMessage: 'upai:unauthorized: invalid bearer token',
        status: 401,
        code: 'unauthorized',
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.error).toBe('upai:unauthorized: invalid bearer token')
    expect(saved?.errorStatus).toBe(401)
  })

  it('joins the parts when they differ', async () => {
    const id = '77777777-7777-4777-8777-777777777777'
    const record = customRecord(id, 0)

    mocks.getJob.mockRejectedValue(
      new ProviderError({
        providerId: 'openrouter',
        kind: 'auth',
        message: 'Invalid API key',
        storedMessage: 'OpenRouter auth failed',
        status: 401,
        code: 'unauthorized',
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.error).toBe('OpenRouter auth failed: Invalid API key')
    expect(saved?.errorStatus).toBe(401)
  })
})

describe('custom record progress', () => {
  it('stores the reported progress on a non-final snapshot', async () => {
    const id = '44444444-4444-4444-8444-444444444441'
    const record = { ...customRecord(id, 0.1), createdAt: new Date().toISOString() }

    mocks.getJob.mockResolvedValue(
      snapshot({
        status: 'in_progress',
        progress: {
          percent: 42,
          queuePosition: null,
          waitingOn: 'comfyui_busy',
        },
      }),
    )

    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.progress).toEqual({
      percent: 42,
      queuePosition: null,
      waitingOn: 'comfyui_busy',
    })
  })
})

describe('removed endpoint', () => {
  it('fails a non-final job with the raw upai code and sends no cancel', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    const record = customRecord(id, 0)

    mocks.endpoints.delete('ep1')
    await repo.saveGeneration(record)
    await processRecord(record)

    const saved = await repo.getGeneration(id)

    expect(saved?.status).toBe('failed')
    expect(saved?.error).toBe('upai:endpoint_removed: Endpoint removed')
    expect(mocks.getJob).not.toHaveBeenCalled()
  })
})
