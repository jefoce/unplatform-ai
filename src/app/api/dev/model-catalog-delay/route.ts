import { z } from 'zod'

import { isCustomEndpointMockMode } from '@/server/config/mock-mode'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { setCatalogDelay } from '@/server/services/catalog-delay'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  ms: z.number().int().min(0).max(5000),
})

/** Delays the model catalog response for the loading-state e2e case. Dev and e2e only. */
export async function POST(request: Request): Promise<Response> {
  try {
    if (!isCustomEndpointMockMode()) {
      return jsonError({ status: 404, error: 'Not found' })
    }

    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    setCatalogDelay(body.data.ms)

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
