/* eslint-disable max-lines, max-lines-per-function -- mock scenarios share one fixture set */

import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { MOCK_GENERATE_MS, MOCK_QUEUE_MS } from '../src/core/constants'
import { VIDEO_PRESETS } from '../src/core/presets'
import type { BindingBase } from '../src/core/presets/common/binding'
import { mapCustomModel } from '../src/core/presets/custom/from-capabilities'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import type { CustomEndpoint } from '../src/core/schemas/custom-endpoint'
import type { GenerationInput } from '../src/core/schemas/generation-record'
import type { ImageGenerationInput } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-custom-mock-${process.pid}-${Date.now()}`)

process.env.STORAGE_ROOT = ROOT

const { isCustomEndpointMockMode } = await import('../src/server/config/mock-mode')

const { createCustomMockImageProvider } = await import('../src/server/providers/mock/custom-image')

const { customMockImagePrompt } = await import('../src/server/services/custom-mock-image-prompt')

const { customMockFixtures } = await import('../src/server/providers/mock/custom-fixtures')

const { CUSTOM_MOCK_STALE_REASON, customMockCatalog } =
  await import('../src/server/providers/mock/custom-models')

const { createCustomMockVideoProvider } = await import('../src/server/providers/mock/custom-video')

const { getImageProvider, getVideoProvider, instanceKind, listInstances } =
  await import('../src/server/providers/registry')

const { lastHealthOf } = await import('../src/server/services/endpoint-test-mock')

const { __resetCustomMockDeletesForTests: resetDeletes, deletedCustomMockResults } =
  await import('../src/server/providers/mock/custom-jobs')

const { catalogStatus } = await import('../src/server/services/catalog-status')

const START = Date.parse('2026-11-07T00:00:00.000Z')
const PRESET = VIDEO_PRESETS[0]
const IMAGE_PRESET = IMAGE_PRESETS[0]

const BINDING: BindingBase = {
  provider: 'custom',
  modelId: 'wan22-i2v',
  pricing: { formula: 'perRun', skuRules: [], fallback: { per_run: 0 } },
}

const ENDPOINT: CustomEndpoint = {
  id: 'mock-ready',
  label: 'Mock ComfyUI',
  badge: 'CU1',
  baseUrl: 'http://mock',
  enabled: true,
  pricing: { mode: 'free', usd: 0 },
  instanceId: 'mock-ready',
  lastHealth: null,
}

function videoInput(prompt: string): GenerationInput {
  return {
    presetId: PRESET.id,
    tab: 'frames',
    prompt,
    audio: false,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
  }
}

function imageInput(prompt: string, count: number): ImageGenerationInput {
  return {
    presetId: IMAGE_PRESET.id,
    prompt,
    count,
    aspectRatio: '16:9',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
  }
}

function submit(provider: ReturnType<typeof createCustomMockVideoProvider>, prompt: string) {
  return provider.submit({ preset: PRESET, input: videoInput(prompt), media: {} })
}

describe('custom mock fixtures', () => {
  it('reflects health and the fixture model counts', () => {
    const fixtures = customMockFixtures()
    const ready = customMockCatalog({ scenario: 'ready' })

    expect(fixtures.health.protocol).toBe(1)
    expect(ready.video).toHaveLength(3)
    expect(ready.image).toHaveLength(1)
    expect(ready.isReachable).toBe(true)
  })

  it('maps result_delete into the stored health, false when absent', () => {
    const health = customMockFixtures().health

    expect(lastHealthOf(health, '2026-01-01T00:00:00.000Z').resultDelete).toBe(true)

    expect(
      lastHealthOf({ ...health, result_delete: undefined }, '2026-01-01T00:00:00.000Z')
        .resultDelete,
    ).toBe(false)
  })

  it('records DELETE calls from the mock adapters', async () => {
    resetDeletes()

    const video = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
    const image = createCustomMockImageProvider({ instanceId: 'mock-ready' })

    await video.deleteResult?.({ jobId: 'video-1', submittedAt: START.toString() })
    await image.deleteResult?.({ jobId: 'image-1', submittedAt: START.toString() })

    expect(deletedCustomMockResults()).toEqual([
      { jobId: 'video-1', kind: 'video' },
      { jobId: 'image-1', kind: 'image' },
    ])
  })

  it('exposes the reference label template on the ready image model', () => {
    const [model] = customMockCatalog({ scenario: 'ready' }).image

    if (model === undefined) {
      throw new Error('Missing ready image model')
    }

    expect(model.capabilities.prompt.reference_label).toBe('<{kind}_{n}>')

    const mapped = mapCustomModel({ endpoint: ENDPOINT, model })

    expect(mapped.preset?.refLabel).toBe('<{kind}_{n}>')
  })

  it('makes the stale model selectable with its reason', () => {
    const catalog = customMockCatalog({ scenario: 'stale' })
    const stale = catalog.video[0]

    expect(stale).toMatchObject({ status: 'stale', status_reason: CUSTOM_MOCK_STALE_REASON })
    expect(catalog.video).toHaveLength(3)
  })

  it('adds the invalid fixture model and keeps its reason', () => {
    const catalog = customMockCatalog({ scenario: 'invalid' })

    const invalid = catalog.image.find((model) => {
      return model.id === 'broken-image'
    })

    expect(catalog.image).toHaveLength(2)

    expect(invalid).toMatchObject({
      status: 'invalid',
      status_reason: 'node class KSampler is not installed',
    })
  })

  it('keeps cached models but reports an unreachable endpoint', async () => {
    const provider = createCustomMockVideoProvider({ instanceId: 'mock-unreachable' })
    const list = await provider.listModels()
    const status = await catalogStatus({ provider, binding: BINDING, label: 'ComfyUI' })

    expect(list.models).toHaveLength(3)
    expect(list.isFresh).toBe(false)
    expect(status.status).toBe('unverified')
    expect(await provider.testConnection()).toMatchObject({ ok: false })
  })
})

describe('custom mock video states', () => {
  it('walks pending, queue wait, in progress and completed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)

    try {
      const provider = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
      const submitted = await submit(provider, 'plain prompt')
      const ref = { jobId: submitted.jobId, submittedAt: new Date(START).toISOString() }

      expect(submitted.status).toBe('pending')

      expect(await provider.getJob(ref)).toMatchObject({
        status: 'pending',
        progress: { percent: 0, waitingOn: 'pack_queue' },
      })

      vi.setSystemTime(START + MOCK_QUEUE_MS + 1)

      expect(await provider.getJob(ref)).toMatchObject({
        status: 'in_progress',
        progress: { waitingOn: null },
      })

      vi.setSystemTime(START + MOCK_QUEUE_MS + MOCK_GENERATE_MS + 1)

      const done = await provider.getJob(ref)

      expect(done.status).toBe('completed')
      expect(done.progress?.percent).toBe(100)
      expect(done.usage?.costUsd).toBe(0)
      expect(done.urls).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports comfyui_busy while ComfyUI holds the queue', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)

    try {
      const provider = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
      const submitted = await submit(provider, '[busy] prompt')

      expect(await provider.getJob({ jobId: submitted.jobId, submittedAt: '' })).toMatchObject({
        status: 'pending',
        progress: { waitingOn: 'comfyui_busy', queuePosition: 1 },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails a [fail] job with the fixture error', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)

    try {
      const provider = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
      const submitted = await submit(provider, '[fail] prompt')
      const finish = MOCK_QUEUE_MS + Math.floor(MOCK_GENERATE_MS / 2) + 1

      vi.setSystemTime(START + finish)

      expect(await provider.getJob({ jobId: submitted.jobId, submittedAt: '' })).toMatchObject({
        status: 'failed',
        error: 'MockSampler: simulated failure',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects [invalid] with the workflow_invalid text', async () => {
    const provider = createCustomMockVideoProvider({ instanceId: 'mock-ready' })

    await expect(submit(provider, '[invalid] prompt')).rejects.toMatchObject({
      code: 'workflow_invalid',
      storedMessage: expect.stringContaining('upai:workflow_invalid:'),
    })
  })

  it('cancels a slow job and keeps it cancelled', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START)

    try {
      const provider = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
      const submitted = await submit(provider, '[slow] prompt')
      const ref = { jobId: submitted.jobId, submittedAt: new Date(START).toISOString() }

      vi.setSystemTime(START + MOCK_QUEUE_MS + 1_000)
      await provider.cancel?.(ref)

      expect(await provider.getJob(ref)).toMatchObject({ status: 'cancelled' })

      await provider.cancel?.(ref)
      vi.setSystemTime(START + MOCK_QUEUE_MS + MOCK_GENERATE_MS * 10 + 1)

      expect((await provider.getJob(ref)).status).toBe('cancelled')
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails every call when the endpoint is unreachable', async () => {
    const provider = createCustomMockVideoProvider({ instanceId: 'mock-unreachable' })

    await expect(submit(provider, 'plain')).rejects.toMatchObject({ code: 'comfy_unavailable' })
  })
})

describe('custom mock image', () => {
  it('returns one png per requested image', async () => {
    const provider = createCustomMockImageProvider({ instanceId: 'mock-ready' })

    const result = await provider.generate({
      preset: IMAGE_PRESET,
      input: imageInput('two cats', 2),
      references: [],
    })

    expect(result.items).toHaveLength(2)
    expect(result.costUsd).toBe(0)

    for (const item of result.items) {
      expect(item).toMatchObject({ mediaType: 'image/png' })
    }
  })

  it('maps [fail] and [invalid] to protocol text', async () => {
    const provider = createCustomMockImageProvider({ instanceId: 'mock-ready' })

    await expect(
      provider.generate({
        preset: IMAGE_PRESET,
        input: imageInput('[fail] prompt', 1),
        references: [],
      }),
    ).rejects.toMatchObject({ storedMessage: expect.stringContaining('upai:job_failed:') })

    await expect(
      provider.generate({
        preset: IMAGE_PRESET,
        input: imageInput('[invalid] prompt', 1),
        references: [],
      }),
    ).rejects.toMatchObject({ storedMessage: expect.stringContaining('upai:workflow_invalid:') })
  })
})

describe('custom mock registry', () => {
  it('selects the in-process adapter only when CUSTOM_ENDPOINT_MOCK=1', () => {
    vi.stubEnv('CUSTOM_ENDPOINT_MOCK', '')

    expect(isCustomEndpointMockMode()).toBe(false)
    expect(listInstances('custom')).toEqual([])

    vi.stubEnv('CUSTOM_ENDPOINT_MOCK', '1')

    try {
      expect(isCustomEndpointMockMode()).toBe(true)
      expect(listInstances('custom')).toHaveLength(4)
      expect(instanceKind('mock-stale')).toBe('custom')
      expect(getVideoProvider('mock-stale').id).toBe('custom')
      expect(getImageProvider('mock-stale').id).toBe('custom')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('records the rendered custom image prompt', async () => {
    const image = createCustomMockImageProvider({ instanceId: 'mock-ready' })
    const preset = { ...IMAGE_PRESET, refLabel: '<{kind}_{n}>' }

    await image.generate({ preset, input: imageInput('@Image 1', 1), references: [] })

    expect(customMockImagePrompt()).toBe('<image_1>')
  })

  it('never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    try {
      const video = createCustomMockVideoProvider({ instanceId: 'mock-ready' })
      const submitted = await submit(video, 'offline prompt')

      await video.listModels()
      await video.testConnection()
      await video.getJob({ jobId: submitted.jobId, submittedAt: new Date(START).toISOString() })

      const image = createCustomMockImageProvider({ instanceId: 'mock-ready' })

      await image.generate({
        preset: IMAGE_PRESET,
        input: imageInput('offline image', 1),
        references: [],
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
