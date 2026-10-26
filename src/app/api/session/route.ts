import { errorResponse, jsonError } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { SESSION_COOKIE, sessionRequired, tokenMatches } from '@/server/session'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  try {
    assertLocalRequest(request, { session: false })

    if (!sessionRequired()) {
      return Response.redirect(new URL('/', request.url), 303)
    }

    const token = new URL(request.url).searchParams.get('t')

    if (!tokenMatches(token)) {
      return jsonError({ status: 401, error: 'Bad session token' })
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: '/',
        'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
