import { assertLocalRequest, errorResponse } from '@/server/http'
import { removeFolder } from '@/server/repos/folders'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertLocalRequest(request)
    const { id } = await params

    await removeFolder(id)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
