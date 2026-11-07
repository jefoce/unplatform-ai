import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { buildMedia as BuildMedia } from '@/server/jobs/submit-media'

import { WAN_30 } from '../src/core/presets/video/wan/wan-3.0'
import { sha256Of, writeUpload } from './helpers/custom-endpoint-fixtures'

const ROOT = path.join(process.cwd(), '.cache', `custom-upload-mock-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const VIDEO_BYTES = Buffer.from('video-bytes')

process.env.STORAGE_ROOT = ROOT
process.env.CUSTOM_ENDPOINT_MOCK = '1'

let buildMedia: typeof BuildMedia
let uploadsDir: string

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ UPLOADS_DIR: uploadsDir } = await import('@/server/paths'))

  ;({ buildMedia } = await import('@/server/jobs/submit-media'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  delete process.env.CUSTOM_ENDPOINT_MOCK

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('custom endpoint mock mode', () => {
  it('returns refs without a network call or an endpoint', async () => {
    const upload = await writeUpload({
      uploadsDir,
      bytes: VIDEO_BYTES,
      ext: '.mp4',
      mime: 'video/mp4',
      kind: 'video',
    })

    const mock = vi.fn<typeof fetch>(async () => {
      throw new Error('fetch must not run in mock mode')
    })

    vi.stubGlobal('fetch', mock)

    const built = await buildMedia({
      uploads: { [upload.id]: upload },
      transports: { [upload.id]: 'upload' },
      preset: WAN_30,
      endpointId: null,
    })

    expect(built.media[upload.id]?.url).toBe(`upai-upload:${sha256Of(VIDEO_BYTES)}`)
    expect(mock).not.toHaveBeenCalled()
  })
})
