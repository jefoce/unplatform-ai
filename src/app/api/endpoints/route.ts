import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { getEndpointOverview } from '@/server/services/endpoint-overview'
import { saveEndpoints, SaveEndpointsBodySchema } from '@/server/services/endpoint-save'

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
