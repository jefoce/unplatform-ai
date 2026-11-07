/* eslint-disable max-lines, max-lines-per-function -- facet cases share one fixture set */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as FacetsRouteModule from '@/app/api/history/facets/route'
import type * as GenerationsRepoModule from '@/server/repos/generations'
import type * as ImagesRepoModule from '@/server/repos/images'
import type * as FacetsModule from '@/server/services/history-facets'

import type { ImageAspectChoice, ImageResolution } from '../src/core/presets/image/types'
import type { AspectChoice, Resolution } from '../src/core/presets/video/types'
import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'
import type { RecordSource } from '../src/core/schemas/record-source'

const ROOT = path.join(os.tmpdir(), `cf-history-facets-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

let generations: typeof GenerationsRepoModule
let images: typeof ImagesRepoModule
let facets: typeof FacetsModule
let route: typeof FacetsRouteModule

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })

  generations = await import('@/server/repos/generations')
  images = await import('@/server/repos/images')
  facets = await import('@/server/services/history-facets')
  route = await import('@/app/api/history/facets/route')
})

beforeEach(async () => {
  for (const record of await generations.listGenerations()) {
    await generations.deleteGenerationFiles(record.id)
  }

  for (const record of await images.listImages()) {
    await images.deleteImageFiles(record.id)
  }
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

interface VideoParams {
  id: string
  createdAt?: string
  presetId?: string
  title?: string
  source?: RecordSource
  resolution?: Resolution
  aspectRatio?: AspectChoice
}

function videoRecord(params: VideoParams): GenerationRecord {
  const {
    id,
    createdAt = '2026-01-01T00:00:00.000Z',
    presetId = 'wan-3.0',
    title = 'Wan 3.0',
    source,
    resolution = '720p',
    aspectRatio = '16:9',
  } = params

  return {
    id,
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: source?.kind ?? 'openrouter',
    source,
    input: {
      presetId,
      tab: 'frames',
      prompt: 'a cat',
      audio: false,
      duration: 5,
      aspectRatio,
      resolution,
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: presetId, title, slug: 'wan' },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'fallback',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: null,
      billed: null,
    },
  }
}

interface ImageParams {
  id: string
  createdAt?: string
  presetId?: string
  title?: string
  source?: RecordSource
  resolution?: ImageResolution | null
  aspectRatio?: ImageAspectChoice
}

function imageRecord(params: ImageParams): ImageRecord {
  const {
    id,
    createdAt = '2026-01-01T00:00:00.000Z',
    presetId = 'gemini-3.1-flash-image',
    title = 'Nano Banana 2',
    source,
    resolution = '1K',
    aspectRatio = '1:1',
  } = params

  return {
    id,
    createdAt,
    updatedAt: createdAt,
    status: 'completed',
    provider: source?.kind ?? 'openrouter',
    source,
    preset: { id: presetId, title, slug: 'gemini' },
    input: {
      presetId,
      prompt: 'a cat',
      count: 1,
      aspectRatio,
      resolution,
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: 0,
      priceSource: 'fallback',
      billed: null,
    },
  }
}

function customSource(presetTitle: string, badge: string): RecordSource {
  return {
    kind: 'custom',
    instanceId: 'endpoint-1',
    badge,
    presetTitle,
    workflowName: 'Wan workflow',
    endpointLabel: 'Studio PC',
    local: true,
  }
}

function facetsRequest(kind: string): Request {
  return new Request(`http://127.0.0.1:3000/api/history/facets?kind=${kind}`, {
    headers: { host: '127.0.0.1:3000' },
  })
}

describe('history facets index', () => {
  it('keeps a rebuild equal to incremental create, update and delete', async () => {
    const first = randomUUID()
    const second = randomUUID()
    const third = randomUUID()

    await generations.saveGeneration(
      videoRecord({
        id: first,
        createdAt: '2026-01-01T00:00:00.000Z',
        presetId: 'wan-3.0',
        title: 'Wan 3.0',
      }),
    )

    await generations.saveGeneration(
      videoRecord({
        id: second,
        createdAt: '2026-01-02T00:00:00.000Z',
        presetId: 'seedance-2.0',
        title: 'Seedance 2.0',
      }),
    )

    await generations.saveGeneration(
      videoRecord({
        id: third,
        createdAt: '2026-01-03T00:00:00.000Z',
        presetId: 'wan-3.0',
        title: 'Wan 3.0',
      }),
    )

    const incremental = await facets.getHistoryFacets('video')

    expect(incremental).toEqual(
      facets.buildHistoryFacets('video', await generations.listGenerations()),
    )

    expect(
      incremental.models.map((model) => {
        return model.presetId
      }),
    ).toEqual(['wan-3.0', 'seedance-2.0'])

    expect(incremental.models[0]?.count).toBe(2)

    await generations.saveGeneration(
      videoRecord({
        id: first,
        createdAt: '2026-04-01T00:00:00.000Z',
        presetId: 'wan-3.0',
        title: 'Renamed Wan',
      }),
    )

    const afterUpdate = await facets.getHistoryFacets('video')

    const wan = afterUpdate.models.find((model) => {
      return model.presetId === 'wan-3.0'
    })

    expect(wan?.title).toBe('Renamed Wan')
    expect(wan?.lastAt).toBe('2026-04-01T00:00:00.000Z')

    await generations.deleteGenerationFiles(third)

    const afterDelete = await facets.getHistoryFacets('video')

    expect(
      afterDelete.models.find((model) => {
        return model.presetId === 'wan-3.0'
      })?.count,
    ).toBe(1)
  })

  it('lists only models that have records, newest first', async () => {
    await generations.saveGeneration(
      videoRecord({ id: randomUUID(), createdAt: '2026-01-01T00:00:00.000Z' }),
    )

    await generations.saveGeneration(
      videoRecord({
        id: randomUUID(),
        createdAt: '2026-02-01T00:00:00.000Z',
        presetId: 'seedance-2.0',
        title: 'Seedance 2.0',
      }),
    )

    await generations.saveGeneration(
      videoRecord({ id: randomUUID(), createdAt: '2026-03-01T00:00:00.000Z' }),
    )

    const result = await facets.getHistoryFacets('video')

    expect(
      result.models.map((model) => {
        return model.presetId
      }),
    ).toEqual(['wan-3.0', 'seedance-2.0'])

    expect(
      result.models.every((model) => {
        return model.count > 0
      }),
    ).toBe(true)
  })

  it('keeps a deleted endpoint model with its badge and count', async () => {
    const source = customSource('Local Wan', 'CU1')

    await generations.saveGeneration(
      videoRecord({
        id: randomUUID(),
        presetId: 'custom.endpoint-1.wan',
        title: 'Local Wan',
        source,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )

    await generations.saveGeneration(
      videoRecord({
        id: randomUUID(),
        presetId: 'custom.endpoint-1.wan',
        title: 'Local Wan',
        source,
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    )

    const result = await facets.getHistoryFacets('video')

    expect(result.models).toEqual([
      {
        presetId: 'custom.endpoint-1.wan',
        title: 'Local Wan',
        badge: 'CU1',
        count: 2,
        lastAt: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('uses the static preset title for records without a source', async () => {
    await generations.saveGeneration(
      videoRecord({ id: randomUUID(), presetId: 'wan-3.0', title: 'Wan 3.0' }),
    )

    const result = await facets.getHistoryFacets('video')

    expect(result.models[0]).toMatchObject({
      presetId: 'wan-3.0',
      title: 'Wan 3.0',
      badge: null,
    })
  })

  it('takes image resolutions and aspects from records', async () => {
    await images.saveImage(imageRecord({ id: randomUUID(), resolution: '1K', aspectRatio: '1:1' }))
    await images.saveImage(imageRecord({ id: randomUUID(), resolution: null, aspectRatio: '16:9' }))

    const result = await facets.getHistoryFacets('image')

    expect(result.kind).toBe('image')
    expect(result.resolutions).toEqual(['1K'])
    expect(result.aspects).toEqual(['16:9', '1:1'])
  })

  it('rejects an unknown kind and returns the requested facets', async () => {
    const bad = await route.GET(facetsRequest('audio'))

    expect(bad.status).toBe(400)

    const ok = await route.GET(facetsRequest('video'))

    expect(ok.status).toBe(200)

    expect(await ok.json()).toEqual({
      kind: 'video',
      models: [],
      resolutions: [],
      aspects: [],
    })
  })
})
