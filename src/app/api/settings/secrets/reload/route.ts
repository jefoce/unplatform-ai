import { errorResponse } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { reloadSecrets, secretStatus } from '@/server/secrets'

/** Retries a failed keychain load and returns fresh status. */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    await reloadSecrets()

    return Response.json(secretStatus())
  } catch (error) {
    return errorResponse(error)
  }
}
