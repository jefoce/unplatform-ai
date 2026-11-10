import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { buildMedia as BuildMedia } from '@/server/jobs/submit-media'
import { ProviderError } from '@/server/providers/provider-error'

import type { UploadsById } from '../src/core/api/uploads'
import { WAN_30 } from '../src/core/presets/video/wan/wan-3.0'
import type { ResolvedTransport } from '../src/core/transport'
import type { Dict } from '../src/core/utility-types'
import { healthRoute, mockFetch, sha256Of, writeUpload } from './helpers/custom-endpoint-fixtures'

const ROOT = path.join(process.cwd(), '.cache', `custom-upload-errors-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT
process.env.UPAI_SECRETS_BACKEND = 'file'
process.env.CUSTOM_ENDPOINT_TOKENS = JSON.stringify({ 'custom-1': 'token-abc' })
delete process.env.CUSTOM_ENDPOINT_MOCK

const ENDPOINTS = {
  version: 1,
  badgeCounter: 2,
  endpoints: [
    {
      id: 'custom-1',
      label: 'Studio',
      badge: 'CU1',
      baseUrl: 'http://127.0.0.1:8188',
      enabled: true,
      pricing: { mode: 'model', usd: 0 },
      instanceId: null,
      lastHealth: null,
    },
    {
      id: 'custom-2',
      label: 'Laptop',
      badge: 'CU2',
      baseUrl: 'http://127.0.0.1:8189',
      enabled: true,
      pricing: { mode: 'model', usd: 0 },
      instanceId: null,
      lastHealth: null,
    },
  ],
}

const VIDEO_BYTES = Buffer.from('video-bytes')

interface BuildParams {
  uploads: UploadsById
  transports: Dict<ResolvedTransport>
  endpointId: string | null
}

let buildMedia: typeof BuildMedia
let uploadsDir: string

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

  await fs.writeFile(path.join(ROOT, 'data', 'endpoints.json'), JSON.stringify(ENDPOINTS))

  uploadsDir = (await import('@/server/paths')).UPLOADS_DIR
  buildMedia = (await import('@/server/jobs/submit-media')).buildMedia
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function makeVideo() {
  return writeUpload({
    uploadsDir,
    bytes: VIDEO_BYTES,
    ext: '.mp4',
    mime: 'video/mp4',
    kind: 'video',
  })
}

async function runBuild(params: BuildParams) {
  const { uploads, transports, endpointId } = params

  return buildMedia({ uploads, transports, preset: WAN_30, endpointId })
}

describe('custom endpoint upload errors', () => {
  it('turns a quota 413 into the plain message', async () => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 404 },
      {
        method: 'POST',
        path: '/upai/api/v1/uploads',
        status: 413,
        body: {
          error: { code: 'too_large', message: 'quota reached', details: { reason: 'quota' } },
        },
      },
    ])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toMatchObject({
      code: 'too_large',
      storedMessage: 'upai:too_large: ComfyUI upload space is full',
    })
  })

  it('rejects a file over max_upload_bytes before the upload call', async () => {
    const upload = await makeVideo()

    mockFetch([healthRoute(4)])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toBeInstanceOf(ProviderError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('custom endpoint upload failures', () => {
  it.each([
    {
      status: 401,
      code: 'unauthorized',
      storedMessage:
        'upai:unauthorized: The endpoint token is not valid. Open Settings and paste the token.',
    },
    {
      status: 403,
      code: 'forbidden',
      storedMessage:
        'upai:forbidden: This computer cannot reach ComfyUI: enable LAN access in ComfyUI Settings > Unplatform AI, or add a token',
    },
  ])('stores a $code upload with the upai prefix', async ({ status, code, storedMessage }) => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      {
        method: 'HEAD',
        path: `/upai/api/v1/uploads/${sha256}`,
        status,
        body: { error: { code, message: 'denied', details: {} } },
      },
    ])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toMatchObject({ code, storedMessage })
  })

  it('stores a malformed upload response as upai:internal', async () => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 404 },
      { method: 'POST', path: '/upai/api/v1/uploads', status: 201, body: {} },
    ])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toMatchObject({
      code: 'protocol',
      storedMessage: 'upai:internal: This server does not speak upai/1',
    })
  })

  it('reports a removed endpoint as a provider error', async () => {
    const upload = await makeVideo()

    mockFetch([])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: null,
      }),
    ).rejects.toMatchObject({
      code: 'endpoint_removed',
      storedMessage: 'upai:endpoint_removed: Endpoint removed',
    })
  })
})

describe('custom endpoint connection errors', () => {
  it('reports connection refusal as comfy_unavailable', async () => {
    const upload = await makeVideo()

    const mock = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed')
    })

    vi.stubGlobal('fetch', mock)

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toMatchObject({
      code: 'comfy_unavailable',
      storedMessage: 'upai:comfy_unavailable: Endpoint unreachable',
    })
  })

  it('asks for a token when the endpoint requires one', async () => {
    const upload = await makeVideo()

    mockFetch([
      {
        method: 'GET',
        path: '/upai/api/v1/health',
        status: 401,
        body: { error: { code: 'unauthorized', message: 'token required', details: {} } },
      },
    ])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-2',
      }),
    ).rejects.toThrow('The endpoint needs a token. Add it in Settings.')
  })
})

describe('custom endpoint redirects', () => {
  it('rejects a redirect without parsing the body', async () => {
    const upload = await makeVideo()

    mockFetch([{ method: 'GET', path: '/upai/api/v1/health', status: 302 }])

    await expect(
      runBuild({
        uploads: { [upload.id]: upload },
        transports: { [upload.id]: 'upload' },
        endpointId: 'custom-1',
      }),
    ).rejects.toMatchObject({ code: 'protocol' })

    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
  })
})
