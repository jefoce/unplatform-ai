import 'server-only'

import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import type { ImageRecord } from '@/core/schemas/image-record'

import { providerStatusOf } from '../providers/provider-error'
import { getImage, saveImage } from '../repos/images'
import { withLock } from '../sync/lock'
import { errorText, isUncertain } from './image-calls'

/** Serializes a read, patch and atomic save for one image record. */
export async function updateImage(
  id: string,
  patch: (record: ImageRecord) => ImageRecord | null,
): Promise<ImageRecord | null> {
  return withLock(id, async () => {
    const record = await getImage(id)

    if (!record) {
      return null
    }

    const next = patch(record)

    if (!next) {
      return null
    }

    return saveImage(next)
  })
}

/** A send that may have reached the provider keeps the charged-maybe warning. */
function failText(record: ImageRecord, error: unknown): string {
  if (record.submit?.stage === 'sending' && isUncertain(error)) {
    return INTERRUPT_SENDING_TEXT
  }

  return errorText(error)
}

export async function failImage(id: string, error: unknown): Promise<void> {
  await updateImage(id, (record) => {
    // A saving record keeps its files for reconcile, never a terminal failure.
    if (record.status !== 'submitting') {
      return null
    }

    const isMaybeCharged = record.submit?.stage === 'sending' && isUncertain(error)

    return {
      ...record,
      status: 'failed',
      error: failText(record, error),
      errorStatus: providerStatusOf(error),
      submit: undefined,
      cost: {
        ...record.cost,
        mayHaveBeenCharged: isMaybeCharged || record.cost.mayHaveBeenCharged === true,
      },
    }
  })
}
