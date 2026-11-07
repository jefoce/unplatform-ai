import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VIDEO_PRESETS } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'
import { UpaiJobSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type { ResolvedMedia } from '@/server/providers/types'

vi.mock('@/server/secrets', () => {
  return {
    getSecret: (name: string) => {
      return name === 'CUSTOM_ENDPOINT_TOKENS' ? JSON.stringify({ ep1: 'tok' }) : null
    },
    secretsReady: async () => {},
  }
})

const { createCustomVideoProvider, toJobSnapshot } = await import('@/server/providers/custom/video')

const { networkError, providerErrorFromResponse, protocolError } =
  await import('@/server/providers/custom/errors')

const ROOT = 'docs/protocol/upai-1/fixtures'

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'Local',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: 'pack-1',
  lastHealth: null,
}

const PRESET: VideoPreset = {
  ...VIDEO_PRESETS[0],
  id: 'custom.ep1.wan22',
  title: 'Local Wan',
  seed: true,
  frames: { start: true, end: true },
  bindings: [
    {
      provider: 'custom',
      modelId: 'wan22',
      pricing: { formula: 'perRun', skuRules: [], fallback: { run: 0 } },
      transport: { image: 'base64', video: 'base64', audio: 'base64' },
    },
  ],
}

const INPUT: GenerationInput = {
  presetId: 'custom.ep1.wan22',
  tab: 'frames',
  prompt: 'a cat',
  audio: false,
  duration: 5,
  aspectRatio: '16:9',
  resolution: '720p',
  frames: { start: 'start', end: 'end' },
  references: [],
  seed: 42,
}

const MEDIA: Record<string, ResolvedMedia> = {
  start: { id: 'start', kind: 'image', url: 'data:image/png;base64,AA' },
  end: { id: 'end', kind: 'image', url: 'data:image/png;base64,BB' },
  refB: { id: 'refB', kind: 'image', url: 'upai-upload:bbb' },
  refA: { id: 'refA', kind: 'video', url: 'upai-upload:aaa' },
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fixture(name: string): Promise<unknown> {
  const raw = await readFile(path.join(process.cwd(), ROOT, name), 'utf8')

  return JSON.parse(raw)
}

describe('custom video adapter submit', () => {
  it('posts the upai body in app slot order with the endpoint token', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(await fixture('create-job-video.json')), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const provider = createCustomVideoProvider(ENDPOINT)
    const submitted = await provider.submit({ preset: PRESET, input: INPUT, media: MEDIA })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    const body: unknown = JSON.parse(String(init?.body))

    expect(String(url)).toBe('http://127.0.0.1:8188/upai/api/v1/videos')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(submitted.status).toBe('pending')

    expect(body).toMatchObject({
      model: 'wan22',
      prompt: 'a cat',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
      seed: 42,
      frame_images: [
        { frame_type: 'first_frame', image_url: { url: 'data:image/png;base64,AA' } },
        { frame_type: 'last_frame', image_url: { url: 'data:image/png;base64,BB' } },
      ],
    })

    expect(Object.keys(body as Record<string, unknown>)).toEqual([
      'model',
      'prompt',
      'duration',
      'resolution',
      'aspect_ratio',
      'seed',
      'frame_images',
    ])
  })

  it('keeps reference order for the references tab', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(await fixture('create-job-video.json')), { status: 202 }),
    )

    const provider = createCustomVideoProvider(ENDPOINT)

    const input: GenerationInput = {
      ...INPUT,
      tab: 'references',
      frames: { start: null, end: null },
      references: ['refB', 'refA'],
    }

    await provider.submit({ preset: PRESET, input, media: MEDIA })

    const body: unknown = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const references = (body as Record<string, unknown>).input_references

    expect(references).toEqual([
      { type: 'image_url', image_url: { url: 'upai-upload:bbb' } },
      { type: 'video_url', video_url: { url: 'upai-upload:aaa' } },
    ])
  })

  it('rebuilds the base URL from the origin when /upai was pasted', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(await fixture('create-job-video.json')), { status: 202 }),
    )

    const provider = createCustomVideoProvider({
      ...ENDPOINT,
      baseUrl: 'http://127.0.0.1:8188/upai',
    })

    await provider.submit({ preset: PRESET, input: INPUT, media: MEDIA })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:8188/upai/api/v1/videos')
  })
})

describe('custom video job mapping', () => {
  it('maps progress, urls, usage and expiry', async () => {
    const job = UpaiJobSchema.parse(await fixture('job-in_progress.json'))
    const snapshot = toJobSnapshot(job)

    expect(snapshot.status).toBe('in_progress')
    expect(snapshot.usage).toEqual({ costUsd: 0, isByok: false, usesEstimatedCost: false })

    expect(snapshot.progress).toEqual({
      percent: 42,
      node: 'MockSampler',
      queuePosition: null,
      waitingOn: null,
    })

    const done = toJobSnapshot(UpaiJobSchema.parse(await fixture('job-completed.json')))

    expect(done.status).toBe('completed')
    expect(done.expiresAt).toBe(1793966400 * 1000)
    expect(done.urls).toHaveLength(1)
  })

  it('stores the protocol form for a failed job error', async () => {
    const snapshot = toJobSnapshot(UpaiJobSchema.parse(await fixture('job-failed.json')))

    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toBe('upai:job_failed: MockSampler: simulated failure')
  })
})

describe('custom protocol errors', () => {
  it('keeps the raw code and the field detail', async () => {
    const error = await providerErrorFromResponse(
      new Response(JSON.stringify(await fixture('error-invalid_request.json')), { status: 400 }),
    )

    expect(error.message).toBe('upai:invalid_request: body must be valid JSON details.field=body')
    expect(error.kind).toBe('input')
  })

  it('maps auth, queue and not-found statuses', async () => {
    const unauthorized = await providerErrorFromResponse(
      new Response(JSON.stringify(await fixture('error-unauthorized.json')), { status: 401 }),
    )

    const queueFull = await providerErrorFromResponse(
      new Response(JSON.stringify(await fixture('error-queue_full.json')), { status: 429 }),
    )

    const missing = await providerErrorFromResponse(
      new Response(JSON.stringify(await fixture('error-job_not_found.json')), { status: 404 }),
    )

    expect(unauthorized.kind).toBe('auth')
    expect(queueFull.kind).toBe('rate_limit')
    expect(missing.kind).toBe('not_found')
  })

  it('turns connection failures into comfy_unavailable', () => {
    expect(networkError(new Error('fetch failed')).message).toBe(
      'upai:comfy_unavailable: Endpoint unreachable',
    )

    const timeout = new Error('slow')

    timeout.name = 'TimeoutError'

    expect(networkError(timeout).message).toBe('upai:timeout: Request timed out')
    expect(protocolError('bad response').code).toBe('protocol')
  })
})

describe('custom content fetch', () => {
  it('pins the request to the endpoint origin and disables redirects', async () => {
    fetchMock.mockResolvedValue(new Response('video', { status: 200 }))

    const provider = createCustomVideoProvider(ENDPOINT)

    await provider.fetchContent({
      job: { jobId: 'job-1', submittedAt: '' },
      index: 0,
      fallback: null,
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []

    expect(String(url)).toBe('http://127.0.0.1:8188/upai/api/v1/videos/job-1/content?index=0')
    expect(init?.redirect).toBe('manual')
  })

  it('rejects a redirect instead of following it', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://evil.test/x' } }),
    )

    const provider = createCustomVideoProvider(ENDPOINT)

    await expect(
      provider.fetchContent({
        job: { jobId: 'job-1', submittedAt: '' },
        index: 0,
        fallback: null,
      }),
    ).rejects.toMatchObject({ code: 'protocol' })
  })
})
