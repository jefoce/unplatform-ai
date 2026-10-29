import { COPY_EXPIRED_TEXT } from '@/core/provider-errors/app'
import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { retryDownload } from '@/server/jobs/generation-actions'
import { assertLocalRequest } from '@/server/request-guard'

/** Re-queues the provider copy of a failed download without submitting again. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const result = await retryDownload(id)

    if (result === 'not_found') {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    if (result === 'not_failed') {
      return jsonError({ status: 409, error: 'Generation has not failed' })
    }

    if (result === 'not_download_failure') {
      return jsonError({ status: 409, error: 'This generation did not fail while downloading' })
    }

    if (result === 'no_job') {
      return jsonError({ status: 409, error: 'This copy has no provider job' })
    }

    if (result === 'expired') {
      return jsonError({ status: 409, error: COPY_EXPIRED_TEXT })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
