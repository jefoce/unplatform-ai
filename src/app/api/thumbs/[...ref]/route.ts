import fs from 'node:fs/promises'

import { clamp } from 'lodash-es'

import { THUMB_WIDTH } from '@/core/constants'
import { resolveMediaRef } from '@/server/fs/media-ref'
import { streamFile } from '@/server/fs/range-response'
import { errorResponse, jsonError, type PathRouteContext } from '@/server/http'
import { getThumbnail } from '@/server/media/thumbs'
import { assertLocalRequest } from '@/server/request-guard'

export async function GET(request: Request, { params }: PathRouteContext) {
  try {
    assertLocalRequest(request)
    const { ref } = await params
    const media = await resolveMediaRef(ref)

    const stats = await fs.stat(media.absolutePath).catch(() => {
      return null
    })

    if (!stats) {
      return jsonError({ status: 404, error: 'File not found' })
    }

    const parsedWidth = Number.parseInt(new URL(request.url).searchParams.get('w') ?? '', 10)
    const isRequested = Number.isNaN(parsedWidth) || parsedWidth === 0

    const requested = isRequested ? THUMB_WIDTH : parsedWidth
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
