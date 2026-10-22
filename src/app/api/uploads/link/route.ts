import { z } from 'zod'

import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { createGenerationLinkUpload, createLinkUpload } from '@/server/repos/uploads'

const BodySchema = z.union([
  z.object({ folderId: z.string().min(1), relPath: z.string().min(1) }),
  z.object({ absPath: z.string().min(1) }),
  z.object({ generationId: z.string().min(1) }),
])

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) return zodError(body.error)

    const input = body.data

    if ('generationId' in input) {
      return Response.json(await createGenerationLinkUpload(input.generationId), { status: 201 })
    }

    if ('absPath' in input) {
      return Response.json(await createLinkUpload({ absPath: input.absPath }), { status: 201 })
    }

    const item = await createLinkUpload({
      absPath: '',
      folderId: input.folderId,
      relPath: input.relPath,
    })

    return Response.json(item, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
