import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { delayCatalog } from '@/server/services/catalog-delay'
import { getModelCatalog } from '@/server/services/model-catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    const searchParams = new URL(request.url).searchParams
    const isRefreshCustom = searchParams.get('refresh') === '1'
    const isForce = searchParams.get('force') === '1'

    await delayCatalog()

    return jsonResponse(await getModelCatalog({ isRefreshCustom, isForce }))
  } catch (error) {
    return errorResponse(error)
  }
}
