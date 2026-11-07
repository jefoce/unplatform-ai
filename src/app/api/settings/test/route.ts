import { z } from 'zod'

import { STORAGE_PROVIDER_IDS } from '@/core/providers/types'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { testConnection } from '@/server/services/connection-test'

const TargetSchema = z.enum(['openrouter', ...STORAGE_PROVIDER_IDS])
const BodySchema = z.object({ target: TargetSchema })

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    return jsonResponse(await testConnection(body.data.target))
  } catch (error) {
    return errorResponse(error)
  }
}
