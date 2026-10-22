import fs from 'node:fs/promises'

import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { downloadPaths } from '@/server/paths'
import { getGeneration } from '@/server/repos/generations'
import { getSystem } from '@/server/system'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: Params) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const record = await getGeneration(id)

    if (!record) return jsonError({ status: 404, error: 'Video not found' })

    const video = downloadPaths(record.id).video
    const hasVideo = await fs.stat(video).then(
      (stats) => stats.isFile(),
      () => false,
    )

    if (!hasVideo) return jsonError({ status: 404, error: 'Video not found' })

    await getSystem().reveal(video)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
