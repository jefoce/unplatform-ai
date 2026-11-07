import { isNil } from 'lodash-es'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPreset } from '@/core/presets'
import { IMAGE_PRESETS } from '@/core/presets/image'
import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { GenerationInput, GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageGenerationInput, ImageRecord } from '@/core/schemas/image-record'

const ENDPOINT: CustomEndpoint = {
  id: 'ep-snap',
  label: 'Snapshot',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: null,
  lastHealth: null,
}

const mocks = vi.hoisted(() => {
  return {
    loadDraft: vi.fn(),
    getEndpoint: vi.fn(),
    saveGeneration: vi.fn(),
    saveImage: vi.fn(),
  }
})

vi.mock('@/server/services/estimate-generation', () => {
  return { loadDraft: mocks.loadDraft }
})

vi.mock('@/server/jobs/submit-queue', () => {
  return { startSubmit: async () => {} }
})

vi.mock('@/server/jobs/image-submit-queue', () => {
  return { startImageSubmit: async () => {} }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpoint: mocks.getEndpoint,
    getEndpointSync: () => {
      return ENDPOINT
    },
    getEndpointsSync: () => {
      return [ENDPOINT]
    },
    endpointQueueKey: () => {
      return ENDPOINT.id
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return {
    getActiveCount: async () => {
      return 0
    },
    saveGeneration: mocks.saveGeneration,
  }
})

vi.mock('@/server/repos/images', () => {
  return { saveImage: mocks.saveImage }
})

vi.mock('@/server/repos/uploads', () => {
  return {
    getUpload: async () => {
      return null
    },
  }
})

vi.mock('@/server/sync/lock', () => {
  return {
    withLock: async (_key: string, fn: () => Promise<unknown>) => {
      return fn()
    },
  }
})

vi.mock('@/server/media/image-data-url', () => {
  return {
    encodeImages: async () => {
      return { plan: { images: [] }, media: {} }
    },
  }
})

const { createGeneration } = await import('@/server/services/create-generation')
const { createImage } = await import('@/server/services/image-create')

const VIDEO_PRESET: VideoPreset = {
  ...getPreset('wan-3.0'),
  id: `custom.${ENDPOINT.id}.wan`,
  title: 'Local Wan',
}

const IMAGE_PRESET_BASE = IMAGE_PRESETS[0]

function imagePreset(): ImagePreset {
  if (isNil(IMAGE_PRESET_BASE)) {
    throw new Error('Missing image preset')
  }

  return {
    ...IMAGE_PRESET_BASE,
    id: `custom.${ENDPOINT.id}.image`,
    title: 'Local Image',
  }
}

function videoInput(): GenerationInput {
  return {
    presetId: VIDEO_PRESET.id,
    tab: 'frames',
    prompt: 'a cat',
    audio: false,
    duration: VIDEO_PRESET.duration.default,
    aspectRatio: VIDEO_PRESET.defaultAspectRatio,
    resolution: VIDEO_PRESET.defaultResolution,
    frames: { start: null, end: null },
    references: [],
    seed: null,
  }
}

function imageInput(preset: ImagePreset): ImageGenerationInput {
  return {
    presetId: preset.id,
    prompt: 'a cat',
    count: 1,
    aspectRatio: '1:1',
    resolution: null,
    quality: null,
    background: null,
    references: [],
    seed: null,
  }
}

beforeEach(() => {
  mocks.loadDraft.mockReset()
  mocks.getEndpoint.mockReset()
  mocks.saveGeneration.mockReset()
  mocks.saveImage.mockReset()

  mocks.getEndpoint.mockResolvedValue(ENDPOINT)

  mocks.saveGeneration.mockImplementation(async (record: GenerationRecord) => {
    return record
  })

  mocks.saveImage.mockImplementation(async (record: ImageRecord) => {
    return record
  })
})

describe('custom record preset snapshot', () => {
  it('writes the video preset snapshot on create', async () => {
    const input = videoInput()

    mocks.loadDraft.mockResolvedValue({ preset: VIDEO_PRESET, input, uploads: {} })

    const record = await createGeneration(input)

    expect(record.presetSnapshot).toMatchObject({
      id: VIDEO_PRESET.id,
      title: VIDEO_PRESET.title,
      family: VIDEO_PRESET.family,
    })
  })

  it('writes the image preset snapshot on create', async () => {
    const preset = imagePreset()

    const record = await createImage({
      preset,
      input: imageInput(preset),
      price: { estimatedUsd: 0, priceSource: 'fallback' },
    })

    expect(record.presetSnapshot).toMatchObject({
      id: preset.id,
      title: preset.title,
      family: preset.family,
    })
  })
})

describe('custom create price', () => {
  it('notes a per-run price as a per-second value', async () => {
    const input = { ...videoInput(), duration: 5 }

    mocks.loadDraft.mockResolvedValue({ preset: VIDEO_PRESET, input, uploads: {} })

    mocks.getEndpoint.mockResolvedValue({
      ...ENDPOINT,
      pricing: { mode: 'perRun', usd: 2.5 },
    })

    const record = await createGeneration(input)

    expect(record.cost.estimatedUsd).toBeCloseTo(2.5)
    expect(record.cost.pricePerSec).toBeCloseTo(0.5)
  })

  it('keeps the endpoint per-second price', async () => {
    const input = { ...videoInput(), duration: 5 }

    mocks.loadDraft.mockResolvedValue({ preset: VIDEO_PRESET, input, uploads: {} })

    mocks.getEndpoint.mockResolvedValue({
      ...ENDPOINT,
      pricing: { mode: 'perSecond', usd: 0.4 },
    })

    const record = await createGeneration(input)

    expect(record.cost.pricePerSec).toBeCloseTo(0.4)
  })
})
