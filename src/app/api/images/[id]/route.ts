import { errorResponse, type IdRouteContext, jsonError, jsonResponse } from '@/server/http'
import { getImage } from '@/server/repos/images'
import { assertLocalRequest } from '@/server/request-guard'
import { deleteImage } from '@/server/services/image-actions'

export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const record = await getImage(id)

    if (!record) {
      return jsonError({ status: 404, error: 'Image not found' })
    }

    return jsonResponse(record)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const result = await deleteImage(id)

    if (result === 'active') {
      return jsonError({ status: 409, error: 'Cannot delete while generating' })
    }

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Image not found' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
