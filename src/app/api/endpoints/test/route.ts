import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { testEndpoint, TestEndpointBodySchema } from '@/server/services/endpoint-test'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = TestEndpointBodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return jsonResponse(await testEndpoint(body.data))
  } catch (error) {
    return errorResponse(error)
  }
}
