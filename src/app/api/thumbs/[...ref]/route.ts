import fs from 'node:fs/promises'
import path from 'node:path'

import { clamp } from 'lodash-es'

import { POSTER_WIDTHS, THUMB_WIDTH } from '@/core/constants'
import { resolveMediaRef } from '@/server/fs/media-ref'
import { streamFile } from '@/server/fs/range-response'
import { errorResponse, jsonError, jsonResponse, type PathRouteContext } from '@/server/http'
import { getBlurredThumbnail } from '@/server/media/blur-thumb'
import { getThumbnail, ThumbPendingError } from '@/server/media/thumbs'
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

    const search = new URL(request.url).searchParams

    const source = {
      ref: media.ref,
      absolutePath: media.absolutePath,
      kind: media.kind,
      mtimeMs: stats.mtimeMs,
    }

    if (search.get('blur') === '1') {
      const blurred = await getBlurredThumbnail(source)

      return sendThumb(request, blurred.filePath)
    }

    const parsedWidth = Number.parseInt(search.get('w') ?? '', 10)
    const isRequested = Number.isNaN(parsedWidth) || parsedWidth === 0

    const requested = isRequested ? THUMB_WIDTH : parsedWidth
    const maxWidth = Math.max(...POSTER_WIDTHS)
    const width = Math.min(maxWidth, Math.ceil(clamp(requested, 32, maxWidth) / 80) * 80)

    const thumb = await getThumbnail({ ...source, width })

    return sendThumb(request, thumb.filePath)
  } catch (error) {
    if (error instanceof ThumbPendingError) {
      return jsonResponse(
        { error: error.message },
        { status: error.status, headers: { 'Retry-After': '1' } },
      )
    }

    return errorResponse(error)
  }
}

function sendThumb(request: Request, filePath: string): Promise<Response> {
  return streamFile({
    absPath: filePath,
    request,
    opts: {
      cacheControl: 'private, no-cache',
      etag: `"${path.basename(filePath, '.webp')}"`,
    },
  })
}
