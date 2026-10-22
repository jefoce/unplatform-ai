import fs from 'node:fs/promises'

import { clamp } from 'lodash-es'

import { THUMB_WIDTH } from '@/core/constants'
import { resolveMediaRef } from '@/server/fs/media-ref'
import { streamFile } from '@/server/fs/range-response'
import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { getThumbnail } from '@/server/media/thumbs'

interface Params {
  params: Promise<{ ref: string[] }>
}

export async function GET(request: Request, { params }: Params) {
  try {
    assertLocalRequest(request)
    const { ref } = await params
    const media = await resolveMediaRef(ref)
    const stats = await fs.stat(media.absolutePath).catch(() => null)

    if (!stats) return jsonError({ status: 404, error: 'File not found' })

    const parsedWidth = Number.parseInt(new URL(request.url).searchParams.get('w') ?? '', 10)
    const requested = Number.isNaN(parsedWidth) || parsedWidth === 0 ? THUMB_WIDTH : parsedWidth
    const width = Math.min(1280, Math.ceil(clamp(requested, 32, 1280) / 80) * 80)
    const thumb = await getThumbnail({
      ref: media.ref,
      absolutePath: media.absolutePath,
      kind: media.kind,
      mtimeMs: stats.mtimeMs,
      width,
    })

    return streamFile({
      absPath: thumb.filePath,
      request,
      opts: { cacheControl: 'private, max-age=31536000, immutable' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
