import { SHUTDOWN_EXIT_DELAY_MS } from '@/core/constants'
import { errorResponse, jsonError } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { desktopMode } from '@/server/session'
import { shutdownServer } from '@/server/shutdown'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!desktopMode()) {
    return jsonError({ status: 404, error: 'Not found' })
  }

  try {
    assertLocalRequest(request)
  } catch (error) {
    return errorResponse(error)
  }

  setTimeout(() => {
    return void shutdownServer()
  }, SHUTDOWN_EXIT_DELAY_MS) // lets the 202 flush first

  return new Response(null, { status: 202 })
}
