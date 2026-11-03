import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { cancelImage } from '@/server/services/image-actions'

/** Cancels an image only while it is still inside the grace window. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params

    const result = await cancelImage(id)

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Image not found' })
    }

    if (result === 'not_grace') {
      return jsonError({ status: 409, error: 'Already sent, cannot cancel' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
