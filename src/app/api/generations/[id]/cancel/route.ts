import { canCancelInGrace } from '@/core/submit-state'
import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { cancelScheduledSubmit } from '@/server/jobs/submit-queue'
import { deleteGenerationFiles, getGeneration } from '@/server/repos/generations'
import { assertLocalRequest } from '@/server/request-guard'
import { withLock } from '@/server/sync/lock'

/** Cancels a generation only while it is still inside the grace window. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params

    const result = await withLock(id, async () => {
      const record = await getGeneration(id)

      if (!record) {
        return 'missing'
      }

      if (!canCancelInGrace(record)) {
        return 'sent'
      }

      cancelScheduledSubmit(id)
      await deleteGenerationFiles(id)

      return 'cancelled'
    })

    if (result === 'missing') {
      return jsonError({ status: 404, error: 'Generation not found' })
    }

    if (result === 'sent') {
      return jsonError({ status: 409, error: 'Already sent, cannot cancel' })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return errorResponse(error)
  }
}
