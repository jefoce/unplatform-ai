import { isNil } from 'lodash-es'

import { assertLocalRequest, errorResponse } from '@/server/http'
import { getRemoteStore } from '@/server/remote/remote-store'
import { secretsReady } from '@/server/secrets'

/** Tells the client whether cloud storage exists, so validation can warn early. */
export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    await secretsReady()

    return Response.json({
      configured: !isNil(getRemoteStore()),
      mock: Boolean(process.env.REMOTE_MOCK?.trim()),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
