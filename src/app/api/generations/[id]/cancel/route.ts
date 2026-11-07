import { isNil } from 'lodash-es'

import { canCancelInGrace } from '@/core/submit-state'
import { ACTIVE_STATUSES } from '@/core/types'
import { errorResponse, type IdRouteContext, jsonError } from '@/server/http'
import { cancelScheduledSubmit } from '@/server/jobs/submit-queue'
import { getVideoProvider } from '@/server/providers/registry'
import { deleteGenerationFiles, getGeneration } from '@/server/repos/generations'
import { assertLocalRequest } from '@/server/request-guard'
import { withLock } from '@/server/sync/lock'

/** Cancels a grace generation, or stops a running custom job on its endpoint. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params

    const result = await withLock(id, async () => {
      const record = await getGeneration(id)

      if (!record) {
        return 'missing'
      }

      if (canCancelInGrace(record)) {
        cancelScheduledSubmit(id)
        await deleteGenerationFiles(id)

        return 'cancelled'
      }

      const job = record.job

      const isCustomActive = record.provider === 'custom' && ACTIVE_STATUSES.includes(record.status)

      if (!isCustomActive || isNil(job)) {
        return 'sent'
      }

      const instanceId = record.source?.instanceId ?? record.provider
      const provider = getVideoProvider(instanceId)

      if (isNil(provider.cancel)) {
        return 'sent'
      }

      await provider.cancel({ jobId: job.id, submittedAt: job.submittedAt })

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
