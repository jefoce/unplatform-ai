import { z } from 'zod'

import { MEDIA_KINDS } from '@/core/media-kinds'
import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { createLinkUpload } from '@/server/repos/uploads'
import { getSystem } from '@/server/system'

const BodySchema = z.object({
  kinds: z.array(z.enum(MEDIA_KINDS)).min(1),
  multiple: z.boolean(),
})

const PROMPT = 'Choose media files'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) return zodError(body.error)

    const paths = await getSystem().chooseFiles({ ...body.data, prompt: PROMPT })
    const items = await Promise.all(paths.map((absPath) => createLinkUpload({ absPath })))

    return Response.json(items, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
