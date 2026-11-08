/* eslint-disable max-lines-per-function -- cache cases share one storage root */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import imageFixture from '../docs/protocol/upai-1/fixtures/models-image.json'
import videoFixture from '../docs/protocol/upai-1/fixtures/models-video.json'
import { type UpaiModel, UpaiModelListSchema } from '../src/core/protocol/upai'
import { type CustomEndpoint, CustomEndpointSchema } from '../src/core/schemas/custom-endpoint'

const ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-endpoint-models-'))
const DATA_DIR = path.join(ROOT, 'data')
const ENDPOINTS_FILE = path.join(DATA_DIR, 'endpoints.json')

vi.stubEnv('STORAGE_ROOT', ROOT)

const {
  clearEndpointModelCache,
  isEndpointUnreachable,
  isModelMissing,
  listEnabledCustomEndpoints,
  markEndpointReachable,
  markEndpointUnreachable,
  readEndpointModels,
  removeEndpointModelCache,
  writeEndpointModels,
} = await import('@/server/services/endpoint-model-cache')

const VIDEO_MODELS = UpaiModelListSchema.parse(videoFixture).data
const IMAGE_MODELS = UpaiModelListSchema.parse(imageFixture).data

function modelAt(models: readonly UpaiModel[], index: number): UpaiModel {
  const model = models[index]

  if (isNil(model)) {
    throw new Error(`Missing fixture model ${index}`)
  }

  return model
}

function endpoint(id: string, isEnabled: boolean): CustomEndpoint {
  return CustomEndpointSchema.parse({
    id,
    label: id,
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: isEnabled,
  })
}

async function writeEndpointsFile(endpoints: readonly CustomEndpoint[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })

  await fs.writeFile(
    ENDPOINTS_FILE,
    JSON.stringify({ version: 1, endpoints, badgeCounter: endpoints.length }),
  )
}

async function readCacheFile(endpointId: string): Promise<unknown> {
  const text = await fs.readFile(
    path.join(DATA_DIR, 'endpoint-models', `${endpointId}.json`),
    'utf8',
  )

  return JSON.parse(text)
}

beforeEach(async () => {
  clearEndpointModelCache()

  await writeEndpointsFile(
    ['ep-write', 'ep-race', 'ep-missing', 'ep-expiry', 'ep-reach', 'ep-remove'].map((id) => {
      return endpoint(id, true)
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

afterAll(async () => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  await fs.rm(ROOT, { recursive: true, force: true })
})

describe('endpoint model cache', () => {
  it('writes raw protocol models per kind and reads them back', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const image = modelAt(IMAGE_MODELS, 0)

    await writeEndpointModels({ endpointId: 'ep-write', kind: 'video', models: [video] })
    await writeEndpointModels({ endpointId: 'ep-write', kind: 'image', models: [image] })

    const cache = await readEndpointModels('ep-write')

    expect(
      cache?.video.map((item) => {
        return item.id
      }),
    ).toEqual([video.id])

    expect(
      cache?.image.map((item) => {
        return item.id
      }),
    ).toEqual([image.id])

    expect(await readCacheFile('ep-write')).toMatchObject({
      video: [{ id: video.id, kind: 'video' }],
      image: [{ id: image.id, kind: 'image' }],
    })
  })

  it('keeps both kinds when video and image writes run at once', async () => {
    const video = modelAt(VIDEO_MODELS, 0)
    const image = modelAt(IMAGE_MODELS, 0)

    await Promise.all([
      writeEndpointModels({ endpointId: 'ep-race', kind: 'video', models: [video] }),
      writeEndpointModels({ endpointId: 'ep-race', kind: 'image', models: [image] }),
    ])

    const cache = await readEndpointModels('ep-race')

    expect(
      cache?.video.map((item) => {
        return item.id
      }),
    ).toEqual([video.id])

    expect(
      cache?.image.map((item) => {
        return item.id
      }),
    ).toEqual([image.id])

    expect(await readCacheFile('ep-race')).toMatchObject({
      video: [{ id: video.id }],
      image: [{ id: image.id }],
    })
  })

  it('keeps a model that disappeared from a successful fetch as missing', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)

    await writeEndpointModels({ endpointId: 'ep-missing', kind: 'video', models: [first, second] })
    await writeEndpointModels({ endpointId: 'ep-missing', kind: 'video', models: [first] })

    const cache = await readEndpointModels('ep-missing')
    const isMissing = cache ? isModelMissing({ cache, kind: 'video', modelId: second.id }) : false

    expect(
      cache?.video.map((item) => {
        return item.id
      }),
    ).toEqual([first.id, second.id])

    expect(isMissing).toBe(true)
  })

  it('drops a missing model after 30 days and keeps the first missing time', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await writeEndpointModels({ endpointId: 'ep-expiry', kind: 'video', models: [first, second] })

    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    await writeEndpointModels({ endpointId: 'ep-expiry', kind: 'video', models: [first] })

    vi.setSystemTime(new Date('2026-01-21T00:00:00Z'))
    await writeEndpointModels({ endpointId: 'ep-expiry', kind: 'video', models: [first] })

    vi.setSystemTime(new Date('2026-02-02T00:00:00Z'))
    clearEndpointModelCache()
    const cache = await readEndpointModels('ep-expiry')

    expect(
      cache?.video.map((item) => {
        return item.id
      }),
    ).toEqual([first.id])
  })

  it('marks an endpoint reachable again after a successful write', async () => {
    markEndpointUnreachable('ep-reach')
    expect(isEndpointUnreachable('ep-reach')).toBe(true)

    markEndpointReachable('ep-reach')
    expect(isEndpointUnreachable('ep-reach')).toBe(false)

    markEndpointUnreachable('ep-reach')

    await writeEndpointModels({
      endpointId: 'ep-reach',
      kind: 'video',
      models: [modelAt(VIDEO_MODELS, 0)],
    })

    expect(isEndpointUnreachable('ep-reach')).toBe(false)
  })

  it('removes the cache file and memory on delete', async () => {
    await writeEndpointModels({
      endpointId: 'ep-remove',
      kind: 'video',
      models: [modelAt(VIDEO_MODELS, 0)],
    })

    await removeEndpointModelCache('ep-remove')

    expect(await readEndpointModels('ep-remove')).toBeNull()
    await expect(readCacheFile('ep-remove')).rejects.toThrow()
  })

  it('does not recreate a removed cache file from a concurrent write', async () => {
    const first = modelAt(VIDEO_MODELS, 0)
    const second = modelAt(VIDEO_MODELS, 1)

    await writeEndpointModels({ endpointId: 'ep-remove', kind: 'video', models: [first] })
    await writeEndpointsFile([])

    await Promise.all([
      removeEndpointModelCache('ep-remove'),
      writeEndpointModels({ endpointId: 'ep-remove', kind: 'video', models: [second] }),
    ])

    expect(await readEndpointModels('ep-remove')).toBeNull()
    await expect(readCacheFile('ep-remove')).rejects.toThrow()
  })

  it('rejects an unsafe endpoint id', async () => {
    await expect(
      writeEndpointModels({ endpointId: '../escape', kind: 'video', models: [] }),
    ).rejects.toThrow('Invalid endpoint id')

    expect(await readEndpointModels('../escape')).toBeNull()
  })

  it('reads only enabled endpoints from the endpoint file', async () => {
    await writeEndpointsFile([endpoint('ep-enabled', true), endpoint('ep-disabled', false)])

    const endpoints = await listEnabledCustomEndpoints()

    expect(
      endpoints.map((item) => {
        return item.id
      }),
    ).toEqual(['ep-enabled'])
  })

  it('treats a broken endpoint file as empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(ENDPOINTS_FILE, JSON.stringify({ version: 'nope' }))

    expect(await listEnabledCustomEndpoints()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })
})
