import 'server-only'

import { isNil, isString } from 'lodash-es'

import { isDownloadFailure } from '@/core/download-failure'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord, RecordJob } from '@/core/schemas/generation-record'
import { canCancelInGrace } from '@/core/submit-state'
import { ACTIVE_STATUSES } from '@/core/types'

import { exists } from '../fs/stat'
import { downloadPaths } from '../paths'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { instanceIdOf } from '../providers/custom/record-instance'
import { getVideoProvider } from '../providers/registry'
import type { JobSnapshot } from '../providers/types'
import { deleteGenerationFiles, getGeneration, saveGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { isDownloadQueued, queueDownload } from './download-queue'
import { cancelScheduledSubmit } from './submit-queue'

export type DeleteResult = 'deleted' | 'not_found' | 'active'

export type CancelGenerationResult = 'cancelled' | 'sent' | 'not_found' | 'endpoint_removed'

interface RunningCancel {
  instanceId: string
  job: RecordJob
}

type CancelLockedResult = CancelGenerationResult | RunningCancel

export type RetryDownloadResult =
  'queued' | 'not_found' | 'not_failed' | 'not_download_failure' | 'no_job' | 'expired'

/** Sets one record's favorite flag under its lock. */
export function setFavorite(id: string, isFavorite: boolean): Promise<GenerationRecord | null> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return null
    }

    return saveGeneration({ ...record, favorite: isFavorite })
  })
}

/** Deletes a record, active jobs and downloads are refused unless still in grace. */
export function deleteGeneration(id: string): Promise<DeleteResult> {
  if (isDownloadQueued(id)) {
    return Promise.resolve('active')
  }

  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return 'not_found'
    }

    if (isDownloadQueued(id) || !isNil(record.download)) {
      return 'active'
    }

    if (ACTIVE_STATUSES.includes(record.status) && !canCancelInGrace(record)) {
      return 'active'
    }

    if (canCancelInGrace(record)) {
      cancelScheduledSubmit(id)
    }

    await deleteGenerationFiles(id)

    return 'deleted'
  })
}

/** Cancels a grace generation, or stops a running custom job after the record lock drains. */
export async function cancelGeneration(id: string): Promise<CancelGenerationResult> {
  const running = await withLock(id, async (): Promise<CancelLockedResult> => {
    const record = await getGeneration(id)

    if (!record) {
      return 'not_found'
    }

    if (canCancelInGrace(record)) {
      cancelScheduledSubmit(id)
      await deleteGenerationFiles(id)

      return 'cancelled'
    }

    const isCustomActive = record.provider === 'custom' && ACTIVE_STATUSES.includes(record.status)

    if (!isCustomActive || isNil(record.job)) {
      return 'sent'
    }

    const instanceId = instanceIdOf(record)

    if (isNil(getEndpointSync(instanceId))) {
      return 'endpoint_removed'
    }

    return { instanceId, job: record.job }
  })

  if (isString(running)) {
    return running
  }

  const provider = getVideoProvider(running.instanceId)

  if (isNil(provider.cancel)) {
    return 'sent'
  }

  await provider.cancel({ jobId: running.job.id, submittedAt: running.job.submittedAt })

  return 'cancelled'
}

/** True when the provider copy has an expiry that has passed. */
function isJobExpired(expiresAt: number | undefined): boolean {
  return !isNil(expiresAt) && Date.now() > expiresAt
}

/** A failed copy or a job dropped by the age cutoff can still be fetched again. */
function isRetryableStatus(record: GenerationRecord): boolean {
  const isCandidate = record.status === 'failed' || record.status === 'expired'

  return isCandidate && isNil(record.output)
}

/** Reason the record cannot be retried, or null. A committed video needs no provider. */
function retryBlocked(record: GenerationRecord, hasVideo: boolean): RetryDownloadResult | null {
  if (record.status === 'failed' && !isDownloadFailure(record)) {
    return 'not_download_failure'
  }

  if (hasVideo) {
    return null
  }

  if (!isNonEmptyString(record.job?.id)) {
    return 'no_job'
  }

  if (isJobExpired(record.job.expiresAt)) {
    return 'expired'
  }

  return null
}

/** Re-queues the provider copy of a failed or expired record, never a paid resubmit. */
export async function retryDownload(id: string): Promise<RetryDownloadResult> {
  const queued = await withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return 'not_found'
    }

    if (!isRetryableStatus(record)) {
      return 'not_failed'
    }

    const hasVideo = await exists(downloadPaths(record.id).video)
    const blocked = retryBlocked(record, hasVideo)

    if (!isNil(blocked)) {
      return blocked
    }

    const expiresAt = record.job?.expiresAt

    const saved = await saveGeneration({
      ...record,
      status: 'in_progress',
      error: undefined,
      errorStatus: undefined,
      download: undefined,
    })

    const job: JobSnapshot = {
      status: 'completed',
      generationId: record.job?.generationId ?? null,
      expiresAt: expiresAt ?? null,
      urls: null,
      usage: null,
      error: null,
    }

    return { saved, job }
  })

  if (isString(queued)) {
    return queued
  }

  await queueDownload(queued.saved, queued.job)

  return 'queued'
}
