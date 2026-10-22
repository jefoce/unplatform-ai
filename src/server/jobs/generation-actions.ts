import 'server-only'

import { canCancelInGrace } from '@/core/submit-state'
import { ACTIVE_STATUSES, type GenerationRecord } from '@/core/types'

import { deleteGenerationFiles, getGeneration, saveGeneration } from '../repos/generations'
import { withLock } from './lock'
import { cancelScheduledSubmit } from './submit-queue'

export type DeleteResult = 'deleted' | 'not_found' | 'active'

/** Sets one record's favorite flag under its lock. */
export function setFavorite(id: string, isFavorite: boolean): Promise<GenerationRecord | null> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) return null

    return saveGeneration({ ...record, favorite: isFavorite })
  })
}

/** Deletes a record, active jobs are refused unless still in the grace window. */
export function deleteGeneration(id: string): Promise<DeleteResult> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) return 'not_found'

    if (ACTIVE_STATUSES.includes(record.status) && !canCancelInGrace(record)) return 'active'

    if (canCancelInGrace(record)) cancelScheduledSubmit(id)

    await deleteGenerationFiles(id)

    return 'deleted'
  })
}
