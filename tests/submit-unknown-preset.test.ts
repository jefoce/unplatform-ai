import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '../src/core/schemas/generation-record'

const control = vi.hoisted(() => {
  return { current: null as GenerationRecord | null }
})

const loadUploads = vi.hoisted(() => {
  return vi.fn(async () => {
    return {}
  })
})

const submitVideo = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/services/uploads', () => {
  return { loadUploads }
})

vi.mock('@/server/services/model-catalog', async () => {
  const { findPreset } = await import('@/core/presets')

  return {
    findVideoPresetAny: async (presetId: string) => {
      return findPreset(presetId)
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
  loadUploads.mockClear()
  control.current = null
})

describe('runSubmit unknown preset', () => {
  it('fails a grace record whose preset was removed', async () => {
    control.current = makeRecord()

    await runSubmit(control.current.id)

    expect(control.current?.status).toBe('failed')
    expect(control.current?.error).toBe('Unknown model')
    expect(control.current?.submit).toBeUndefined()
    expect(submitVideo).not.toHaveBeenCalled()
    expect(loadUploads).not.toHaveBeenCalled()
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
      presetId: 'removed-model',
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
    preset: { id: 'removed-model', title: 'Removed model', slug: 'removed/model' },
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
