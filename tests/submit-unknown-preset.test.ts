import { afterEach, describe, expect, it, vi } from 'vitest'

import { endpointRemovedError, networkError } from '@/server/providers/custom/errors'

import { WAN_30 } from '../src/core/presets/video/wan/wan-3.0'
import type { GenerationRecord } from '../src/core/schemas/generation-record'

const control = vi.hoisted(() => {
  return { current: null as GenerationRecord | null }
})

const endpointSource = vi.hoisted(() => {
  return { existing: new Set<string>() }
})

const submitMedia = vi.hoisted(() => {
  return {
    buildMedia: vi.fn(),
    recordSent: vi.fn(async () => {}),
    send: vi.fn(),
    uploadUrls: vi.fn(async () => {}),
  }
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

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return endpointSource.existing.has(id) ? {} : null
    },
  }
})

vi.mock('@/server/jobs/submit-media', () => {
  return submitMedia
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
  submitMedia.buildMedia.mockReset()
  endpointSource.existing.clear()
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

  it('reports a removed endpoint for a custom record', async () => {
    control.current = makeRecord({ provider: 'custom', source: customSource('ep-gone') })

    await runSubmit(control.current.id)

    expect(control.current?.error).toBe('upai:endpoint_removed: Endpoint removed')
  })

  it('stores upai texts for custom upload failures', async () => {
    endpointSource.existing.add('ep-found')

    control.current = makeRecord({
      provider: 'custom',
      source: customSource('ep-found'),
      input: input({ presetId: WAN_30.id }),
    })

    submitMedia.buildMedia.mockRejectedValueOnce(endpointRemovedError())

    await runSubmit(control.current.id)

    expect(control.current?.error).toMatch(/^upai:endpoint_removed:/)

    control.current = makeRecord({
      provider: 'custom',
      source: customSource('ep-found'),
      input: input({ presetId: WAN_30.id }),
    })

    submitMedia.buildMedia.mockRejectedValueOnce(networkError(new TypeError('fetch failed')))

    await runSubmit(control.current.id)

    expect(control.current?.error).toMatch(/^upai:comfy_unavailable:/)
  })
})

function input(overrides: Partial<GenerationRecord['input']> = {}): GenerationRecord['input'] {
  return {
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
    ...overrides,
  }
}

function customSource(instanceId: string): NonNullable<GenerationRecord['source']> {
  return {
    kind: 'custom',
    instanceId,
    badge: 'CU1',
    presetTitle: 'Local Wan',
    workflowName: null,
    endpointLabel: 'Studio',
    local: true,
  }
}

function makeRecord(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: 'openrouter',
    input: input(),
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
    ...overrides,
  }
}
