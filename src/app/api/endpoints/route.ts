import { SaveEndpointsBodySchema } from '@/core/api/endpoints'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { getEndpointOverview } from '@/server/services/endpoint-overview'
import { saveEndpoints } from '@/server/services/endpoint-save'
import { clearEndpointTests } from '@/server/services/endpoint-test'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    return jsonResponse(await getEndpointOverview())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    assertLocalRequest(request)
    const body = SaveEndpointsBodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return jsonResponse(await saveEndpoints(body.data))
  } catch (error) {
    return errorResponse(error)
  }
}

/** Drops draft test results when the settings draft is discarded. */
export async function DELETE(request: Request) {
  try {
    assertLocalRequest(request)
    clearEndpointTests()

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
