import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { getCredits } from '@/server/services/credits'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const isFresh = new URL(request.url).searchParams.get('fresh') === '1'

    return jsonResponse(await getCredits({ fresh: isFresh }))
  } catch (error) {
    return errorResponse(error)
  }
}
