import { z } from 'zod'

import { assertLocalRequest, errorResponse, readJsonBody, zodError } from '@/server/http'
import { addFolder, listFolders } from '@/server/repos/folders'

const BodySchema = z.object({ path: z.string().trim().min(1) })

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    return Response.json(await listFolders())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) return zodError(body.error)

    return Response.json(await addFolder(body.data), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
