import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { buildMedia as BuildMedia } from '@/server/jobs/submit-media'

import type { UploadsById } from '../src/core/api/uploads'
import { WAN_30 } from '../src/core/presets/video/wan/wan-3.0'
import type { ResolvedTransport } from '../src/core/transport'
import type { Dict } from '../src/core/utility-types'
import {
  healthRoute,
  mockFetch,
  sha256Of,
  uploadRoute,
  writeUpload,
} from './helpers/custom-endpoint-fixtures'

const ROOT = path.join(process.cwd(), '.cache', `custom-upload-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const BASE_URL = 'http://127.0.0.1:8188'

process.env.STORAGE_ROOT = ROOT
process.env.UPAI_SECRETS_BACKEND = 'file'
process.env.CUSTOM_ENDPOINT_TOKENS = JSON.stringify({ 'custom-1': 'token-abc' })
delete process.env.CUSTOM_ENDPOINT_MOCK

const ENDPOINTS = {
  version: 1,
  badgeCounter: 1,
  endpoints: [
    {
      id: 'custom-1',
      label: 'Studio',
      badge: 'CU1',
      baseUrl: BASE_URL,
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

  ;({ UPLOADS_DIR: uploadsDir } = await import('@/server/paths'))

  ;({ buildMedia } = await import('@/server/jobs/submit-media'))
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

async function makeImage() {
  const bytes = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#334455' },
  })
    .png()
    .toBuffer()

  return writeUpload({ uploadsDir, bytes, ext: '.png', mime: 'image/png', kind: 'image' })
}

async function runBuild(params: BuildParams) {
  const { uploads, transports, endpointId } = params

  return buildMedia({ uploads, transports, preset: WAN_30, endpointId })
}

describe('custom endpoint upload transport', () => {
  it('skips the POST when HEAD reports the hash', async () => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 200 },
    ])

    const built = await runBuild({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'upload' },
      endpointId: 'custom-1',
    })

    expect(built.media[upload.id]?.url).toBe(`upai-upload:${sha256}`)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('uploads a missing hash and uses the returned ref', async () => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 404 },
      uploadRoute(sha256),
    ])

    const built = await runBuild({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'upload' },
      endpointId: 'custom-1',
    })

    expect(built.media[upload.id]?.url).toBe(`upai-upload:${sha256}`)

    const post = vi.mocked(fetch).mock.calls.find(([, init]) => {
      return init?.method === 'POST'
    })

    const body = post?.[1]?.body

    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(Blob)
  })

  it('sends one HEAD and one POST for two uploads with the same bytes', async () => {
    const first = await makeVideo()
    const second = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 404 },
      uploadRoute(sha256),
    ])

    const built = await runBuild({
      uploads: { [first.id]: first, [second.id]: second },
      transports: { [first.id]: 'upload', [second.id]: 'upload' },
      endpointId: 'custom-1',
    })

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(built.media[first.id]?.url).toBe(built.media[second.id]?.url)
  })
})

describe('custom endpoint inline inputs', () => {
  it('keeps an image on a data URL even when its transport says upload', async () => {
    const upload = await makeImage()

    mockFetch([])

    const built = await runBuild({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'upload' },
      endpointId: 'custom-1',
    })

    expect(built.media[upload.id]?.url.startsWith('data:image/')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(0)
  })

  it('does not touch R2 for the upload transport', async () => {
    const upload = await makeVideo()
    const sha256 = sha256Of(VIDEO_BYTES)

    mockFetch([
      healthRoute(100 * 1024 * 1024),
      { method: 'HEAD', path: `/upai/api/v1/uploads/${sha256}`, status: 200 },
    ])

    const built = await runBuild({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'upload' },
      endpointId: 'custom-1',
    })

    const urls = vi.mocked(fetch).mock.calls.map(([input]) => {
      return String(input)
    })

    expect(built.media[upload.id]?.url).toBe(`upai-upload:${sha256}`)

    expect(
      urls.every((url) => {
        return url.startsWith(BASE_URL)
      }),
    ).toBe(true)
  })

  it('keeps a base64 video unchanged for a static preset', async () => {
    const upload = await makeVideo()

    mockFetch([])

    const built = await runBuild({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'base64' },
      endpointId: null,
    })

    expect(built.media[upload.id]?.url.startsWith('data:video/mp4;base64,')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(0)
  })
})
