import { assertLocalRequest, errorResponse } from '@/server/http'
import { getCredits } from '@/server/openrouter/credits'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const isFresh = new URL(request.url).searchParams.get('fresh') === '1'

    return Response.json(await getCredits({ fresh: isFresh }))
  } catch (error) {
    return errorResponse(error)
  }
}
