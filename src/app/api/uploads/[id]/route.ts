import { errorResponse, type IdRouteContext } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { removeUpload } from '@/server/services/uploads'

export async function DELETE(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params

    await removeUpload(id)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
