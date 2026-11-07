import { describe, expect, it, vi } from 'vitest'

import { WAN_30 } from '@/core/presets/video/wan/wan-3.0'
import type { ResolvedTransport } from '@/core/transport'

const uploadCustomRefs = vi.hoisted(() => {
  return vi.fn<(params: { instanceId: string | null; signal?: AbortSignal }) => Promise<unknown>>()
})

vi.mock('@/server/jobs/custom-endpoint-media', () => {
  return { uploadCustomRefs }
})

const { buildMedia } = await import('@/server/jobs/submit-media')

const UPLOAD_ID = 'video-1'

describe('buildMedia signal', () => {
  it('passes the abort signal through to uploadCustomRefs', async () => {
    const controller = new AbortController()
    const signal = controller.signal

    controller.abort()
    uploadCustomRefs.mockResolvedValue({ [UPLOAD_ID]: 'upai-upload:abc' })

    const transports: Record<string, ResolvedTransport> = { [UPLOAD_ID]: 'upload' }

    await buildMedia({
      uploads: {
        [UPLOAD_ID]: {
          id: UPLOAD_ID,
          source: 'file',
          kind: 'video',
          mime: 'video/mp4',
          ext: '.mp4',
          originalName: 'clip.mp4',
          sizeBytes: 4,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
      transports,
      preset: WAN_30,
      endpointId: 'ep1',
      signal,
    })

    expect(uploadCustomRefs).toHaveBeenCalledWith(expect.objectContaining({ signal }))
  })
})
