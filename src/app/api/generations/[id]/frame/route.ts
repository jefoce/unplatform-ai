import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { errorResponse, type IdRouteContext, jsonError, zodError } from '@/server/http'
import { extractBoundaryFrame } from '@/server/media/ffmpeg'
import { downloadPaths, DOWNLOADS_DIR } from '@/server/paths'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { createFileUpload } from '@/server/services/uploads'

const BodySchema = z.object({ at: z.enum(['first', 'last']) })

export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const record = await getGeneration(id)

    if (!record) {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    const videoPath = downloadPaths(record.id).video

    const isReady =
      record.status === 'completed' &&
      Boolean(record.output?.video) &&
      (await fs.stat(videoPath).then(
        (stats) => {
          return stats.isFile()
        },
        () => {
          return false
        },
      ))

    if (!isReady) {
      return jsonError({ status: 409, error: 'Video is not ready' })
    }

    const temp = path.join(DOWNLOADS_DIR, `${record.id}.frame-${randomUUID()}.tmp.png`)

    try {
      try {
        await extractBoundaryFrame({ videoPath, at: body.data.at, outPath: temp })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Frame extraction failed'

        return jsonError({ status: 409, error: message })
      }

      const bytes = new Uint8Array(await fs.readFile(temp))

      const item = await createFileUpload({
        bytes,
        originalName: `${record.id}-${body.data.at}-frame.png`,
      })

      return Response.json(item, { status: 201 })
    } finally {
      await fs.unlink(temp).catch(() => {})
    }
  } catch (error) {
    return errorResponse(error)
  }
}
