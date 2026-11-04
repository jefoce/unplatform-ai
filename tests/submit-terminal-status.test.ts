import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { ACTIVE_STATUSES } from '../src/core/types'

const control = vi.hoisted(() => {
  return { current: null as GenerationRecord | null }
})

vi.mock('@/server/secrets', () => {
  return {
    getSecret: () => {
      return 'test-key'
    },
    secretsReady: async () => {},
  }
})

vi.mock('@/server/repos/uploads', () => {
  return {
    getUpload: async () => {
      return null
    },
  }
})

vi.mock('@/server/storage/registry', () => {
  return {
    getObjectStore: () => {
      return null
    },
  }
})

vi.mock('@/server/jobs/poller', () => {
  return { startPoller: () => {} }
})

vi.mock('@/server/jobs/submit-retry', () => {
  return {
    shouldRetryAsBase64: () => {
      return false
    },
  }
})

vi.mock('@/server/providers/registry', async () => {
  const { createOpenRouterProvider } = await import('@/server/providers/openrouter/provider')

  return {
    getVideoProvider: () => {
      return createOpenRouterProvider()
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getGeneration: async () => {
      return control.current
    },
    saveGeneration: async (record: GenerationRecord) => {
      control.current = { ...record, updatedAt: new Date().toISOString() }

      return control.current
    },
  }
})

const { runSubmit } = await import('@/server/jobs/run-submit')

afterEach(() => {
  vi.unstubAllGlobals()
  control.current = null
})

describe('runSubmit terminal submit reply', () => {
  it('stores completed as pending for the poller', async () => {
    control.current = makeRecord()

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return new Response(JSON.stringify({ id: 'job-1', status: 'completed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await runSubmit(control.current.id)

    expect(control.current?.status).toBe('pending')
    expect(ACTIVE_STATUSES).toContain(control.current?.status)
    expect(control.current?.job?.id).toBe('job-1')
  })
})

function makeRecord(): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
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
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
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
