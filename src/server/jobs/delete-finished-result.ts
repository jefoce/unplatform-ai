import 'server-only'

import { isNil } from 'lodash-es'

import type { UpaiJobKind } from '@/core/protocol/upai'
import type { ProviderKindId } from '@/core/providers/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { getEndpointSync } from '../providers/custom/endpoint-source'
import { getImageProvider, getVideoProvider } from '../providers/registry'
import type { JobRef } from '../providers/types'

interface FinishedResultSource {
  instanceId: string
}

interface FinishedResultJob {
  id: string
  submittedAt: string
}

interface FinishedResultRecord {
  provider: ProviderKindId
  source?: FinishedResultSource
  job?: FinishedResultJob
}

interface DeleteFinishedResultParams {
  record: FinishedResultRecord
  kind: UpaiJobKind
}

interface CleanupParams {
  instanceId: string
  job: JobRef
  kind: UpaiJobKind
}

/** Null unless this endpoint allows deletes and still exists. */
function targetEndpointOf(record: FinishedResultRecord): CustomEndpoint | null {
  if (record.provider !== 'custom') {
    return null
  }

  const instanceId = record.source?.instanceId

  if (isNil(instanceId)) {
    return null
  }

  const endpoint = getEndpointSync(instanceId)

  if (isNil(endpoint) || endpoint.lastHealth?.resultDelete !== true) {
    return null
  }

  return endpoint
}

async function cleanup(params: CleanupParams): Promise<void> {
  const { instanceId, job, kind } = params

  try {
    if (kind === 'video') {
      await getVideoProvider(instanceId).deleteResult?.(job)

      return
    }

    await getImageProvider(instanceId).deleteResult?.(job)
  } catch {
    console.warn('[unplatform-ai] finished result cleanup failed')
  }
}

/**
 * Best effort: removes one saved custom result from its ComfyUI endpoint.
 * Never retries and never touches the record.
 */
export function deleteFinishedResult(params: DeleteFinishedResultParams): void {
  const { record, kind } = params
  const endpoint = targetEndpointOf(record)
  const jobId = record.job?.id

  if (isNil(endpoint) || isNil(jobId)) {
    return
  }

  const job = { jobId, submittedAt: record.job?.submittedAt ?? '' }

  void cleanup({ instanceId: endpoint.id, job, kind })
}
