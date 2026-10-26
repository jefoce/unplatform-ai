import fs from 'node:fs/promises'

import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { downloadPaths } from '@/server/paths'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest } from '@/server/request-guard'
import { getSystem } from '@/server/system'

export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const record = await getGeneration(id)

    if (!record) {
      return jsonError({ status: 404, error: 'Video not found' })
    }

    const video = downloadPaths(record.id).video

    const hasVideo = await fs.stat(video).then(
      (stats) => {
        return stats.isFile()
      },
      () => {
        return false
      },
    )

    if (!hasVideo) {
      return jsonError({ status: 404, error: 'Video not found' })
    }

    await getSystem().reveal(video)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
