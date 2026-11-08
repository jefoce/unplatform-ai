/* eslint-disable max-lines -- one concurrency harness keeps the cases together */

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { IMAGE_SUBMIT_PARALLEL } from '../src/core/constants'
import type { ImageGenerationInput, ImageRecord } from '../src/core/schemas/image-record'

const ROOT = path.join(os.tmpdir(), `cf-image-instance-limit-${process.pid}-${Date.now()}`)
const IMAGES = path.join(ROOT, 'images')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const control = vi.hoisted(() => {
  const IMAGE_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  const endpoints = new Map<string, { id: string; instanceId: string }>()
  const limits = new Map<string, number>()

  const counters = {
    started: [] as string[],
    active: 0,
    peak: 0,
    activeByKey: new Map<string, number>(),
    peakByKey: new Map<string, number>(),
  }

  let gate = Promise.withResolvers<void>()

  const reset = () => {
    counters.started = []
    counters.active = 0
    counters.peak = 0
    counters.activeByKey.clear()
    counters.peakByKey.clear()
    gate = Promise.withResolvers<void>()
  }

  const release = () => {
    gate.resolve()
  }

  const generate = async (endpointId: string, params: unknown) => {
    const key = endpoints.get(endpointId)?.instanceId ?? endpointId
    const input = (params as { input: { count: number } }).input

    counters.started.push(key)
    counters.active += 1
    counters.peak = Math.max(counters.peak, counters.active)

    const active = (counters.activeByKey.get(key) ?? 0) + 1

    counters.activeByKey.set(key, active)
    counters.peakByKey.set(key, Math.max(counters.peakByKey.get(key) ?? 0, active))

    try {
      await gate.promise

      return {
        items: Array.from({ length: input.count }, () => {
          return { b64: IMAGE_B64, mediaType: 'image/png' }
        }),
        costUsd: 0,
      }
    } finally {
      counters.active -= 1
      counters.activeByKey.set(key, (counters.activeByKey.get(key) ?? 1) - 1)
    }
  }

  return { endpoints, limits, counters, reset, release, generate }
})

vi.mock('@/server/secrets', () => {
  return { secretsReady: async () => {} }
})

vi.mock('@/server/services/model-catalog', () => {
  const preset = {
    id: 'test-pack',
    title: 'Test Pack',
    family: 'custom',
    description: '',
    icon: 'sparkles',
    resolutions: null,
    defaultResolution: null,
    aspectRatios: ['1:1'],
    defaultAspectRatio: '1:1',
    qualities: null,
    defaultQuality: null,
    backgrounds: null,
    defaultBackground: null,
    params: [],
    maxN: 1,
    referenceMax: 0,
    seed: false,
    promptMaxChars: 1000,
    refLabel: 'reference {n}',
    bindings: [],
    errors: [],
  }

  return {
    findImagePresetAny: async () => {
      return preset
    },
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getImageProvider: (instanceId: string) => {
      return {
        id: instanceId,
        isConfigured: () => {
          return true
        },
        generate: (params: unknown) => {
          return control.generate(instanceId, params)
        },
        listModels: async () => {
          return { models: [], isFresh: true }
        },
        testConnection: async () => {
          return { ok: true }
        },
      }
    },
  }
})

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointSync: (id: string) => {
      return control.endpoints.get(id) ?? null
    },
    endpointQueueKey: (endpoint: { id: string; instanceId: string }) => {
      return endpoint.instanceId ?? endpoint.id
    },
  }
})

vi.mock('@/server/services/endpoint-health', () => {
  return {
    getMaxRunning: (key: string) => {
      return control.limits.get(key) ?? 1
    },
    recordHealthOk: () => {},
    recordHealthFromError: () => {},
  }
})

interface ImagesModule {
  saveImage: (record: ImageRecord) => Promise<ImageRecord>
}

interface RunModule {
  runImageSubmit: (id: string, signal?: AbortSignal) => Promise<'done' | 'requeue'>
}

let repo: ImagesModule
let runner: RunModule

const defaultInput: ImageGenerationInput = {
  presetId: 'test-pack',
  prompt: 'a cat',
  count: 4,
  aspectRatio: '1:1',
  resolution: null,
  quality: null,
  background: null,
  references: [],
  seed: null,
}

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(IMAGES, { recursive: true })

  repo = await import('@/server/repos/images')
  runner = await import('@/server/jobs/image-run')
})

beforeEach(() => {
  control.reset()
  control.endpoints.clear()
  control.limits.clear()
  control.endpoints.set('ep-a', { id: 'ep-a', instanceId: 'pack-a' })
  control.endpoints.set('ep-b', { id: 'ep-b', instanceId: 'pack-b' })
  control.limits.set('pack-a', 1)
  control.limits.set('pack-b', 1)
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

function makeRecord(id: string, instanceId?: string): ImageRecord {
  const now = new Date().toISOString()

  const outputs = Array.from({ length: defaultInput.count }, (_, index) => {
    return { id: randomUUID(), index, status: 'pending' as const }
  })

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: instanceId === undefined ? 'openrouter' : 'custom',
    source:
      instanceId === undefined
        ? undefined
        : {
            kind: 'custom',
            instanceId,
            badge: 'CU1',
            presetTitle: 'Test Pack',
            workflowName: null,
            endpointLabel: 'Test',
            local: true,
          },
    preset: { id: 'test-pack', title: 'Test Pack', slug: 'test' },
    input: defaultInput,
    submit: { stage: 'grace', notBefore: '2020-01-01T00:00:00.000Z' },
    outputs,
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

describe('image submit limits', () => {
  it('runs one call at a time for one pack instance', async () => {
    const first = randomUUID()
    const second = randomUUID()

    await repo.saveImage(makeRecord(first, 'ep-a'))
    await repo.saveImage(makeRecord(second, 'ep-a'))

    const firstRun = runner.runImageSubmit(first)
    const secondRun = runner.runImageSubmit(second)

    await vi.waitFor(() => {
      expect(control.counters.started).toHaveLength(1)
    })

    control.release()
    await Promise.all([firstRun, secondRun])

    expect(control.counters.peak).toBe(1)
  })

  it('runs one call per instance key at the same time', async () => {
    const first = randomUUID()
    const second = randomUUID()

    await repo.saveImage(makeRecord(first, 'ep-a'))
    await repo.saveImage(makeRecord(second, 'ep-b'))

    const firstRun = runner.runImageSubmit(first)
    const secondRun = runner.runImageSubmit(second)

    await vi.waitFor(() => {
      expect(control.counters.started).toHaveLength(2)
    })

    control.release()
    await Promise.all([firstRun, secondRun])

    expect(control.counters.peak).toBe(2)
    expect(control.counters.peakByKey.get('pack-a')).toBe(1)
    expect(control.counters.peakByKey.get('pack-b')).toBe(1)
  })

  it('keeps OpenRouter at the image submit parallel limit', async () => {
    const id = randomUUID()

    await repo.saveImage(makeRecord(id))

    const run = runner.runImageSubmit(id)

    await vi.waitFor(() => {
      expect(control.counters.started).toHaveLength(IMAGE_SUBMIT_PARALLEL)
    })

    control.release()
    await run

    expect(control.counters.peak).toBe(IMAGE_SUBMIT_PARALLEL)
  })
})
