import { z } from 'zod'

import { HISTORY_BATCH_MAX } from '@/core/constants'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { rememberExportFolder, rememberExportPath } from '@/server/services/export-tokens'
import { desktopMode, parentSecretMatches } from '@/server/session'

const ExportFileSchema = z.object({ path: z.string().trim().min(1) })

const ExportFolderSchema = z.object({
  folder: z.string().trim().min(1),
  uses: z.number().int().min(1).max(HISTORY_BATCH_MAX),
})

const BodySchema = z.union([ExportFileSchema, ExportFolderSchema])

/** Desktop parent only: registers the path or folder its dialog returned. */
export async function POST(request: Request) {
  if (!desktopMode()) {
    return jsonError({ status: 404, error: 'Not found' })
  }

  try {
    assertLocalRequest(request)

    if (!parentSecretMatches(request.headers.get('x-unplatform-ai-parent'))) {
      return jsonError({ status: 403, error: 'Forbidden' })
    }

    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    if ('folder' in body.data) {
      rememberExportFolder(body.data.folder, body.data.uses)
    } else {
      rememberExportPath(body.data.path)
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
