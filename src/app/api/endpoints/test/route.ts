import { EndpointTestBodySchema } from '@/core/api/endpoints'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { testEndpoint } from '@/server/services/endpoint-test'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = EndpointTestBodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return jsonResponse(await testEndpoint(body.data))
  } catch (error) {
    return errorResponse(error)
  }
}
