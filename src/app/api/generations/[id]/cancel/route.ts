import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { cancelGeneration } from '@/server/jobs/generation-actions'
import { assertLocalRequest } from '@/server/request-guard'

/** Cancels a grace generation, or stops a running custom job on its endpoint. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const result = await cancelGeneration(id)

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    if (result === 'sent') {
      return jsonError({ status: 409, error: 'Already sent, cannot cancel' })
    }

    if (result === 'endpoint_removed') {
      return jsonError({ status: 409, error: 'This endpoint was removed.' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
