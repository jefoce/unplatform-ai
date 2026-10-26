import { z } from 'zod'

import { errorResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { createGenerationLinkUpload, createLinkUpload } from '@/server/services/uploads'

const FolderLinkSchema = z.object({ folderId: z.string().min(1), relPath: z.string().min(1) })

const AbsPathLinkSchema = z.object({ absPath: z.string().min(1) })

const GenerationLinkSchema = z.object({ generationId: z.string().min(1) })

const BodySchema = z.union([FolderLinkSchema, AbsPathLinkSchema, GenerationLinkSchema])

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

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
