import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { ProviderError, type ProviderErrorKind } from '@/server/providers/provider-error'

const control = vi.hoisted(() => {
  return { current: null as GenerationRecord | null }
})

const submitVideo = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
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

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return { submit: submitVideo }
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
  submitVideo.mockReset()
  control.current = null
})

describe('runSubmit uncertain failure', () => {
  it('stores the interrupt text when a timeout hits while sending', async () => {
    control.current = makeRecord()
    submitVideo.mockRejectedValueOnce(providerError({ kind: 'timeout', status: 0 }))

    await runSubmit(control.current.id)

    expect(control.current?.status).toBe('failed')
    expect(control.current?.error).toBe(INTERRUPT_SENDING_TEXT)
  })

  it('stores the provider message when the provider answers 400 while sending', async () => {
    control.current = makeRecord()
    submitVideo.mockRejectedValueOnce(providerError({ kind: 'input', status: 400 }))

    await runSubmit(control.current.id)

    expect(control.current?.status).toBe('failed')
    expect(control.current?.error).toBe('Prompt rejected')
    expect(control.current?.error).not.toBe(INTERRUPT_SENDING_TEXT)
  })
})

interface ProviderErrorOptions {
  kind: ProviderErrorKind
  status: number
}

function providerError(params: ProviderErrorOptions): ProviderError {
  const { kind, status } = params

  return new ProviderError({
    providerId: 'openrouter',
    kind,
    message: 'Prompt rejected',
    storedMessage: 'Prompt rejected',
    status,
    code: null,
  })
}

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
