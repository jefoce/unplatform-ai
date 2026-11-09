import { isCustomEndpointMockMode } from '@/server/config/mock-mode'
import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { customMockImagePrompt } from '@/server/services/custom-mock-image-prompt'

export const dynamic = 'force-dynamic'

/** Returns the prompt the custom image mock last sent upstream. Dev and e2e only. */
export async function GET(request: Request): Promise<Response> {
  try {
    if (!isCustomEndpointMockMode()) {
      return new Response('Not found', { status: 404 })
    }

    assertLocalRequest(request)

    return jsonResponse({ prompt: customMockImagePrompt() })
  } catch (error) {
    return errorResponse(error)
  }
}
