import path from 'node:path'

import { isNil } from 'lodash-es'

import type { MediaKind } from '@/core/media-types'
import { resolveMediaRef } from '@/server/fs/media-ref'
import { streamFile } from '@/server/fs/range-response'
import { errorResponse, jsonError, type PathRouteContext } from '@/server/http'
import { CompatError, type CompatMedia, getCompatMedia } from '@/server/media/compat'
import { assertLocalRequest } from '@/server/request-guard'

export const dynamic = 'force-dynamic'

/** Download names are immutable uuids, uploads and folders can change. */
function cacheControlFor(ref: string, isCompat: boolean): string {
  if (isCompat) {
    return 'private, max-age=3600'
  }

  if (ref.startsWith('downloads/')) {
    return 'private, max-age=31536000, immutable'
  }

  return 'private, max-age=0, must-revalidate'
}

export async function GET(request: Request, { params }: PathRouteContext) {
  try {
    assertLocalRequest(request)
    const { ref } = await params
    const media = await resolveMediaRef(ref)
    const search = new URL(request.url).searchParams
    const isDownload = search.get('download') === '1'
    let compatKind: Exclude<MediaKind, 'image'> | null = null

    if (search.get('compat') === '1' && media.kind !== 'image') {
      compatKind = media.kind
    }

    let target: CompatMedia | null = null

    if (!isNil(compatKind)) {
      target = await getCompatMedia({
        absPath: media.absolutePath,
        kind: compatKind,
        ref: media.ref,
      })
    }

    const name = path.basename(media.absolutePath)
    const downloadName = isDownload ? name : undefined

    const response = await streamFile({
      absPath: target?.path ?? media.absolutePath,
      request,
      opts: {
        downloadName,
        cacheControl: cacheControlFor(media.ref, Boolean(target)),
      },
    })

    if (response.status === 404) {
      return jsonError({ status: 404, error: 'File not found' })
    }

    return response
  } catch (error) {
    if (error instanceof CompatError) {
      return jsonError({ status: error.status, error: error.message })
    }

    return errorResponse(error)
  }
}
