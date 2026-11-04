import { z } from 'zod'

import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { addFolder, listFolders } from '@/server/repos/folders'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

const BodySchema = z.object({ path: z.string().trim().min(1) })

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    return jsonResponse(await listFolders())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return jsonResponse(await addFolder(body.data), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
