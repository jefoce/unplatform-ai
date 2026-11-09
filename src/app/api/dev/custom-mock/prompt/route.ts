import { isCustomEndpointMockMode } from '@/server/config/mock-mode'
import { errorResponse, jsonResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { customMockImagePrompt } from '@/server/services/custom-mock-image-prompt'
import { customMockVideoPrompt } from '@/server/services/custom-mock-video-prompt'

export const dynamic = 'force-dynamic'

/** Returns the prompt the custom mock last sent upstream. Dev and e2e only. */
export async function GET(request: Request): Promise<Response> {
  try {
    assertLocalRequest(request)

    if (!isCustomEndpointMockMode()) {
      return new Response('Not found', { status: 404 })
    }

    const kind = new URL(request.url).searchParams.get('kind')
    let prompt = customMockImagePrompt()

    if (kind === 'video') {
      prompt = customMockVideoPrompt()
    }

    return jsonResponse({ prompt })
  } catch (error) {
    return errorResponse(error)
  }
}
