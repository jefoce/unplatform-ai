import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'

import type { JobSnapshot } from '../providers/types'
import { listGenerations } from '../repos/generations'
import { queueDownload } from './download-queue'

/** Completed-job snapshot rebuilt from a stored record, no provider call needed. */
export function completedJob(record: GenerationRecord): JobSnapshot {
  return {
    status: 'completed',
    generationId: record.job?.generationId ?? null,
    expiresAt: record.job?.expiresAt ?? null,
    urls: null,
    usage: null,
    error: null,
  }
}

/** Re-queues every record still carrying the download marker after a restart. */
export async function resumeMarkedDownloads(): Promise<void> {
  for (const record of await listGenerations()) {
    if (isNil(record.download) || !isNil(record.output)) {
      continue
    }

    if (!isNonEmptyString(record.job?.id)) {
      continue
    }

    await queueDownload(record, completedJob(record))
  }
}
