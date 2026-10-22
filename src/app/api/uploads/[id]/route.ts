import { inputIds } from '@/core/submit-state'
import { assertLocalRequest, errorResponse } from '@/server/http'
import { listActiveGenerations } from '@/server/repos/generations'
import { removeUpload, UploadError } from '@/server/repos/uploads'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const active = await listActiveGenerations()

    if (active.some((record) => inputIds(record.input).includes(id))) {
      throw new UploadError(409, 'Used by a running generation')
    }

    await removeUpload(id)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
