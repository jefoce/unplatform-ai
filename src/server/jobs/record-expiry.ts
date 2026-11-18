import 'server-only'

import { MAX_JOB_AGE_MIN } from '@/core/constants'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { updateGeneration } from '../repos/generations'

/**
 * True while an active record has been running longer than the age bound.
 */
export function isAgedOut(record: GenerationRecord, status: JobStatus): boolean {
  if (status !== 'pending' && status !== 'in_progress') {
    return false
  }

  return Date.now() - Date.parse(record.createdAt) > MAX_JOB_AGE_MIN * 60_000
}

/**
 * Expires an active record once it passes the age bound.
 */
export async function expireRecord(id: string): Promise<void> {
  await updateGeneration(id, (latest) => {
    if (!ACTIVE_STATUSES.includes(latest.status)) {
      return null
    }

    return { ...latest, status: 'expired', error: 'Job expired' }
  })
}
