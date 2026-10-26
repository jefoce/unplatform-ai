import { isNil, uniq } from 'lodash-es'
import { z } from 'zod'

import { MAX_IDS, MAX_REQUEST_MB, REQUEST_RESERVE_MB } from '@/core/constants'
import { findPreset } from '@/core/presets'
import type { UploadItem } from '@/core/schemas/upload-item'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { encodeImages } from '@/server/media/image-data-url'
import { getUpload } from '@/server/repos/uploads'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

export const dynamic = 'force-dynamic'

const PlanSchema = z.object({
  presetId: z.string(),
  ids: z.array(z.uuid()).max(MAX_IDS),
})

/** Encodes attached images with the submit ladder and returns the planned step. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = PlanSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const preset = findPreset(body.data.presetId)

    if (!preset) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    const items = await Promise.all(
      uniq(body.data.ids).map((id) => {
        return getUpload(id)
      }),
    )

    const uploads = items.filter((item): item is UploadItem => {
      return !isNil(item) && item.kind === 'image' && item.missing !== true
    })

    const { plan } = await encodeImages({
      uploads,
      preset,
      budgetBytes: MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024,
    })

    return Response.json(plan)
  } catch (error) {
    return errorResponse(error)
  }
}
