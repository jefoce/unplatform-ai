import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  batchImageOutputs,
  createImage,
  createImageOutputUpload,
  deleteImageOutput,
  deleteImageRecord,
  fetchImageEstimate,
  fetchImagePage,
  imagePageKey,
  setOutputFavorite,
} from '@/lib/api/images'
import { imageEstimateKey, IMAGES_KEY } from '@/lib/api/swr-keys'

import type { ImageSubmitBody } from '../src/core/api/image'
import { required } from './helpers/required'

interface Call {
  url: string
  init?: RequestInit
}

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3302'

const calls: Call[] = []

function bodyOf(call: Call): unknown {
  return JSON.parse(String(call.init?.body))
}

function stubFetch(): void {
  calls.length = 0

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({ url, init })

    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('image API client', () => {
  it('posts the submit body to /api/images', async () => {
    stubFetch()

    const input: ImageSubmitBody = {
      presetId: 'fixture',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: null,
      quality: null,
      background: null,
      references: [],
      seed: null,
    }

    await createImage(input)

    expect(required(calls[0], 'call').url).toBe('/api/images')
    expect(required(calls[0], 'call').init?.method).toBe('POST')
    expect(bodyOf(required(calls[0], 'call'))).toEqual(input)
  })

  it('builds list keys with favorite and ids', () => {
    expect(imagePageKey({})).toBe(IMAGES_KEY)
    expect(imagePageKey({ favorite: true })).toBe('/api/images?favorite=1')
    expect(imagePageKey({ ids: [UUID, OUTPUT_ID] })).toBe(`/api/images?ids=${UUID}%2C${OUTPUT_ID}`)
  })

  it('fetches a page by key', async () => {
    stubFetch()

    await fetchImagePage('/api/images?limit=10')

    expect(required(calls[0], 'call').url).toBe('/api/images?limit=10')
  })

  it('posts the estimate key body', async () => {
    stubFetch()

    await fetchImageEstimate(imageEstimateKey('{"count":1}'))

    expect(required(calls[0], 'call').url).toBe('/api/images/estimate')
    expect(bodyOf(required(calls[0], 'call'))).toEqual({ count: 1 })
  })

  it('patches one output favorite', async () => {
    stubFetch()

    await setOutputFavorite({ recordId: UUID, outputId: OUTPUT_ID, favorite: true })

    expect(required(calls[0], 'call').url).toBe(`/api/images/${UUID}/outputs/${OUTPUT_ID}`)
    expect(required(calls[0], 'call').init?.method).toBe('PATCH')
    expect(bodyOf(required(calls[0], 'call'))).toEqual({ favorite: true })
  })

  it('deletes one output and one record', async () => {
    stubFetch()

    await deleteImageOutput({ recordId: UUID, outputId: OUTPUT_ID })
    await deleteImageRecord(UUID)

    expect(required(calls[0], 'call').url).toBe(`/api/images/${UUID}/outputs/${OUTPUT_ID}`)
    expect(required(calls[0], 'call').init?.method).toBe('DELETE')
    expect(required(calls[1], 'call').url).toBe(`/api/images/${UUID}`)
  })

  it('posts a batch body', async () => {
    stubFetch()

    await batchImageOutputs({
      action: 'favorite',
      outputs: [{ recordId: UUID, outputId: OUTPUT_ID }],
      favorite: true,
    })

    expect(required(calls[0], 'call').url).toBe('/api/images/batch')

    expect(bodyOf(required(calls[0], 'call'))).toEqual({
      action: 'favorite',
      outputs: [{ recordId: UUID, outputId: OUTPUT_ID }],
      favorite: true,
    })
  })

  it('posts the output frame route', async () => {
    stubFetch()

    await createImageOutputUpload({ recordId: UUID, outputId: OUTPUT_ID })

    expect(required(calls[0], 'call').url).toBe(`/api/images/${UUID}/outputs/${OUTPUT_ID}/frame`)
    expect(required(calls[0], 'call').init?.method).toBe('POST')
  })
})
