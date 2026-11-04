import { ImageFavoriteSchema } from '@/core/api/image'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { getImage } from '@/server/repos/images'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { deleteOutput, setOutputFavorite } from '@/server/services/image-actions'

interface OutputParams {
  id: string
  'output-id': string
}

interface OutputRouteContext {
  params: Promise<OutputParams>
}

export async function PATCH(request: Request, { params }: OutputRouteContext) {
  try {
    assertLocalRequest(request)
    const { id, 'output-id': outputId } = await params
    const body = ImageFavoriteSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const record = await getImage(id)

    const isOutput = record?.outputs.some((output) => {
      return output.id === outputId
    })

    if (isOutput !== true) {
      return jsonError({ status: 404, error: 'Output not found' })
    }

    const saved = await setOutputFavorite({ recordId: id, outputId, favorite: body.data.favorite })

    if (!saved) {
      return jsonError({ status: 404, error: 'Output not found' })
    }

    return jsonResponse(saved)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: OutputRouteContext) {
  try {
    assertLocalRequest(request)
    const { id, 'output-id': outputId } = await params
    const record = await getImage(id)

    const isOutput = record?.outputs.some((output) => {
      return output.id === outputId
    })

    if (isOutput !== true) {
      return jsonError({ status: 404, error: 'Output not found' })
    }

    const result = await deleteOutput({ recordId: id, outputId })

    if (result === 'active') {
      return jsonError({ status: 409, error: 'Cannot delete while generating' })
    }

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Output not found' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
