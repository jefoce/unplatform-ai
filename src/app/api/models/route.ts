import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { getModelCatalog } from '@/server/services/model-catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    const isForce = new URL(request.url).searchParams.get('refresh') === '1'

    return jsonResponse(await getModelCatalog({ isRefreshCustom: isForce }))
  } catch (error) {
    return errorResponse(error)
  }
}
