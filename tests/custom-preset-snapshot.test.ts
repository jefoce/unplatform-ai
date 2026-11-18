import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CATALOG_CHECKING_REASON } from '@/core/catalog'
import { CUSTOM_CHECK_TIMEOUT_MS } from '@/core/constants'
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
    runHealthProbe: vi.fn(),
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

vi.mock('@/server/providers/custom/health', () => {
  return { runHealthProbe: mocks.runHealthProbe }
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

const {
  recordHealthOk,
  setEndpointHealth,
  __resetEndpointHealthForTests: resetEndpointHealth,
} = await import('@/server/services/endpoint-health')

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
  resetEndpointHealth()
  recordHealthOk(ENDPOINT.id)
  mocks.loadDraft.mockReset()
  mocks.getEndpoint.mockReset()
  mocks.runHealthProbe.mockReset()
  mocks.saveGeneration.mockReset()
  mocks.saveImage.mockReset()

  mocks.getEndpoint.mockResolvedValue(ENDPOINT)
  mocks.runHealthProbe.mockResolvedValue({ ok: false })

  mocks.saveGeneration.mockImplementation(async (record: GenerationRecord) => {
    return record
  })

  mocks.saveImage.mockImplementation(async (record: ImageRecord) => {
    return record
  })
})

afterEach(() => {
  vi.useRealTimers()
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

    expect(Object.keys(record.presetSnapshot ?? {}).sort()).toEqual(['family', 'id', 'title'])
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

    expect(Object.keys(record.presetSnapshot ?? {}).sort()).toEqual(['family', 'id', 'title'])
  })
})

describe('custom create endpoint health', () => {
  it('rejects a video job while the endpoint is unreachable', async () => {
    const input = videoInput()

    mocks.loadDraft.mockResolvedValue({ preset: VIDEO_PRESET, input, uploads: {} })
    setEndpointHealth({ endpointId: ENDPOINT.id, status: 'unreachable', message: 'Down' })

    const started = Date.now()

    await expect(createGeneration(input)).rejects.toMatchObject({
      status: 400,
      message: 'ComfyUI is not reachable.',
    })

    expect(Date.now() - started).toBeLessThan(100)
    expect(mocks.saveGeneration).not.toHaveBeenCalled()
  })

  it('rejects a video job while the boot probe is still checking', async () => {
    const input = videoInput()

    mocks.loadDraft.mockResolvedValue({ preset: VIDEO_PRESET, input, uploads: {} })
    resetEndpointHealth()
    vi.useFakeTimers()

    const pending = expect(createGeneration(input)).rejects.toMatchObject({
      status: 400,
      message: CATALOG_CHECKING_REASON,
    })

    await vi.advanceTimersByTimeAsync(CUSTOM_CHECK_TIMEOUT_MS)
    await pending

    expect(mocks.saveGeneration).not.toHaveBeenCalled()
  })

  it('rejects an image job while the endpoint is unreachable', async () => {
    const preset = imagePreset()

    setEndpointHealth({ endpointId: ENDPOINT.id, status: 'unreachable', message: 'Down' })

    await expect(
      createImage({
        preset,
        input: imageInput(preset),
        price: { estimatedUsd: 0, priceSource: 'fallback' },
      }),
    ).rejects.toMatchObject({ status: 400, message: 'ComfyUI is not reachable.' })

    expect(mocks.saveImage).not.toHaveBeenCalled()
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
