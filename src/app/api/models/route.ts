import { errorResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { getModelCatalog } from '@/server/services/model-catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    return Response.json(await getModelCatalog())
  } catch (error) {
    return errorResponse(error)
  }
}
