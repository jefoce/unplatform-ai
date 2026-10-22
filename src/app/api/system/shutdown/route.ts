import { SHUTDOWN_EXIT_DELAY_MS, SHUTDOWN_SEND_WAIT_MS } from '@/core/constants'
import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { releaseInstanceLock } from '@/server/instance-lock'
import { stopPoller } from '@/server/jobs/poller'
import { stopSubmits, waitForSendingDone } from '@/server/jobs/submit-queue'
import { stopAllFfmpeg } from '@/server/media/ffmpeg'
import { sessionRequired } from '@/server/session'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!sessionRequired()) return jsonError({ status: 404, error: 'Not found' })

  try {
    assertLocalRequest(request)
  } catch (error) {
    return errorResponse(error)
  }

  setTimeout(() => void shutdown(), SHUTDOWN_EXIT_DELAY_MS) // lets the 202 flush first

  return new Response(null, { status: 202 })
}

/** Stops new work, lets sends finish, then exits. */
async function shutdown(): Promise<void> {
  stopPoller()
  stopSubmits()
  stopAllFfmpeg()
  await waitForSendingDone(SHUTDOWN_SEND_WAIT_MS)
  releaseInstanceLock()
  process.exit(0)
}
