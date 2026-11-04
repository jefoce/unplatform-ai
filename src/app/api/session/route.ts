import { z } from 'zod'

import { errorResponse, jsonError, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { SESSION_COOKIE, tokenMatches } from '@/server/session'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({ token: z.string().min(1) })

/**
 * Sets a host-only, HttpOnly, SameSite=Strict cookie.
 * Secure is omitted because the desktop origin is plain http on 127.0.0.1.
 */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, { session: false })

    const body = BodySchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    if (!tokenMatches(body.data.token)) {
      return jsonError({ status: 401, error: 'Bad session token' })
    }

    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': `${SESSION_COOKIE}=${body.data.token}; HttpOnly; SameSite=Strict; Path=/`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
