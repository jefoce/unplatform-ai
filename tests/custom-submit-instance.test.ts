import { describe, expect, it, vi } from 'vitest'

import type { UploadsById } from '@/core/api/uploads'
import { WAN_30 } from '@/core/presets/video/wan/wan-3.0'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { ResolvedTransport } from '@/core/transport'
import type { Dict } from '@/core/utility-types'
import { ProviderError } from '@/server/providers/provider-error'
import type { SubmittedJob } from '@/server/providers/types'

const state = vi.hoisted(() => {
  return {
    submit: vi.fn<(params: unknown) => Promise<SubmittedJob>>(),
    getVideoProvider: vi.fn(),
    uploadCustomRefs: vi.fn(async () => {
      return {}
    }),
  }
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: state.getVideoProvider,
  }
})

vi.mock('@/server/jobs/custom-endpoint-media', () => {
  return {
    uploadCustomRefs: state.uploadCustomRefs,
  }
})

vi.mock('@/server/media/to-data-url', () => {
  return {
    toDataUrl: async () => {
      return { url: 'data:video/mp4;base64,AAAA', bytes: 4 }
    },
  }
})

vi.mock('@/server/media/image-data-url', () => {
  return {
    encodeImages: async () => {
      return { plan: { step: 1, maxSide: 1, totalBytes: 0, images: [] }, media: {} }
    },
  }
})

vi.mock('@/server/jobs/submit-record', () => {
  return {
    throwIfStopped: () => {},
    updateSubmit: async () => {
      return null
    },
  }
})

const { send } = await import('@/server/jobs/submit-media')

const RECORD_ID = '55555555-5555-4555-8555-555555555555'

function record(instanceId: string): GenerationRecord {
  return {
    id: RECORD_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'submitting',
    provider: 'custom',
    source: {
      kind: 'custom',
      instanceId,
      badge: 'CU1',
      presetTitle: 'Local Wan',
      workflowName: null,
      endpointLabel: 'Studio',
      local: true,
    },
    input: {
      presetId: WAN_30.id,
      tab: 'frames',
      prompt: 'a cat',
      audio: false,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: WAN_30.id, title: WAN_30.title, slug: 'wan' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'fallback',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}

function upload(): UploadItem {
  return {
    id: 'upload-1',
    source: 'file',
    kind: 'video',
    mime: 'video/mp4',
    ext: '.mp4',
    originalName: 'ref.mp4',
    sizeBytes: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function transports(): Dict<ResolvedTransport> {
  return { 'upload-1': 'url' }
}

function uploads(): UploadsById {
  return { 'upload-1': upload() }
}

describe('custom submit instance', () => {
  it('submits with the endpoint instance', async () => {
    state.submit.mockResolvedValue({ jobId: 'job-1', status: 'pending' })
    state.getVideoProvider.mockReturnValue({ submit: state.submit })

    const response = await send({
      record: record('ep-send'),
      preset: WAN_30,
      uploads: {},
      transports: {},
      built: {
        media: {},
        encodedBytes: 0,
        plan: { step: 1, maxSide: 1, totalBytes: 0, images: [] },
      },
    })

    expect(response.jobId).toBe('job-1')
    expect(state.getVideoProvider).toHaveBeenCalledWith('ep-send')
  })

  it('keeps the endpoint instance on the base64 retry', async () => {
    state.submit
      .mockRejectedValueOnce(
        new ProviderError({
          providerId: 'custom',
          kind: 'url_input',
          message: 'bad url',
          storedMessage: 'bad url',
          status: 400,
          code: null,
        }),
      )
      .mockResolvedValueOnce({ jobId: 'job-2', status: 'pending' })

    state.getVideoProvider.mockReturnValue({ submit: state.submit })
    state.uploadCustomRefs.mockClear()

    const response = await send({
      record: record('ep-retry'),
      preset: WAN_30,
      uploads: uploads(),
      transports: transports(),
      built: {
        media: {},
        encodedBytes: 0,
        plan: { step: 1, maxSide: 1, totalBytes: 0, images: [] },
      },
    })

    expect(response.jobId).toBe('job-2')
    expect(state.getVideoProvider).toHaveBeenCalledWith('ep-retry')

    expect(state.uploadCustomRefs).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'ep-retry' }),
    )
  })
})
