import { z } from 'zod'

import { errorResponse, type IdRouteContext, jsonError, zodError } from '@/server/http'
import { deleteGeneration, setFavorite } from '@/server/jobs/generation-actions'
import { getGeneration } from '@/server/repos/generations'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

const PatchSchema = z.object({ favorite: z.boolean() })

export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const record = await getGeneration(id)

    if (!record) {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    return Response.json(record)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const body = PatchSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const saved = await setFavorite(id, body.data.favorite)

    if (!saved) {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    return Response.json(saved)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const result = await deleteGeneration(id)

    if (result === 'active') {
      return jsonError({ status: 409, error: 'Cannot delete while generating' })
    }

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
