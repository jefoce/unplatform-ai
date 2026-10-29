import 'server-only'

import { isNil } from 'lodash-es'

import { isDownloadFailure } from '@/core/download-failure'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { canCancelInGrace } from '@/core/submit-state'
import { ACTIVE_STATUSES } from '@/core/types'

import type { JobSnapshot } from '../providers/types'
import { deleteGenerationFiles, getGeneration, saveGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { queueDownload } from './download-queue'
import { cancelScheduledSubmit } from './submit-queue'

export type DeleteResult = 'deleted' | 'not_found' | 'active'

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

/** Deletes a record, active jobs are refused unless still in the grace window. */
export function deleteGeneration(id: string): Promise<DeleteResult> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return 'not_found'
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

/** True when the provider copy has an expiry that has passed. */
function isJobExpired(expiresAt: number | undefined): boolean {
  return !isNil(expiresAt) && Date.now() > expiresAt
}

/** Re-queues the provider copy of a failed record, never a paid resubmit. */
export function retryDownload(id: string): Promise<RetryDownloadResult> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return 'not_found'
    }

    if (record.status !== 'failed' || !isNil(record.output)) {
      return 'not_failed'
    }

    if (!isDownloadFailure(record)) {
      return 'not_download_failure'
    }

    if (!isNonEmptyString(record.job?.id)) {
      return 'no_job'
    }

    const { expiresAt } = record.job

    if (isJobExpired(expiresAt)) {
      return 'expired'
    }

    const saved = await saveGeneration({
      ...record,
      status: 'in_progress',
      error: undefined,
      download: undefined,
    })

    const job: JobSnapshot = {
      status: 'completed',
      generationId: record.job.generationId ?? null,
      expiresAt: expiresAt ?? null,
      urls: null,
      usage: null,
      error: null,
    }

    await queueDownload(saved, job)

    return 'queued'
  })
}
