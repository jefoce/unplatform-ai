import 'server-only'

import type { GenerationRecord } from '@/core/schemas/generation-record'

import { getGeneration, saveGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { isSubmitStopped } from './submit-queue'

/** Serializes a read, patch and atomic save for one record. */
export async function updateSubmit(
  id: string,
  patch: (record: GenerationRecord) => GenerationRecord | null,
): Promise<GenerationRecord | null> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (!record) {
      return null
    }

    const next = patch(record)

    if (next) {
      return saveGeneration(next)
    }

    return null
  })
}

/** Uploads stop when shutdown closes the queue, sends are allowed to finish. */
export function throwIfStopped(signal?: AbortSignal): void {
  if (signal?.aborted === true || isSubmitStopped()) {
    throw new Error('Interrupted while uploading inputs')
  }
}
