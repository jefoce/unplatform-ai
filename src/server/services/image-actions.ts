import 'server-only'

import { type ImageOutput, type ImageRecord, isImageActive } from '@/core/schemas/image-record'

import { cancelScheduledImageSubmit } from '../jobs/image-submit-queue'
import { deleteImageFiles, getImage, removeImageOutputFile, saveImage } from '../repos/images'
import { withLock } from '../sync/lock'

export type DeleteImageResult = 'deleted' | 'not_found' | 'active'
export type DeleteOutputResult = 'deleted' | 'not_found' | 'active'
export type CancelImageResult = 'cancelled' | 'not_grace' | 'not_found'

interface SetOutputFavoriteParams {
  recordId: string
  outputId: string
  favorite: boolean
}

/** Sets one saved output's favorite flag under its record lock. */
export async function setOutputFavorite(
  params: SetOutputFavoriteParams,
): Promise<ImageRecord | null> {
  const { recordId, outputId, favorite: isFavorite } = params

  return withLock(recordId, async () => {
    const record = await getImage(recordId)

    if (!record) {
      return null
    }

    const isSaved = record.outputs.some((item) => {
      return item.id === outputId && item.status === 'saved'
    })

    if (!isSaved) {
      return null
    }

    const outputs = record.outputs.map((item): ImageOutput => {
      if (item.id !== outputId || item.status !== 'saved') {
        return item
      }

      return { ...item, favorite: isFavorite }
    })

    return saveImage({ ...record, outputs })
  })
}

interface DeleteOutputParams {
  recordId: string
  outputId: string
}

/** Removes one output file. The record goes too when it held the last output. */
export async function deleteOutput(params: DeleteOutputParams): Promise<DeleteOutputResult> {
  const { recordId, outputId } = params

  return withLock(recordId, async () => {
    const record = await getImage(recordId)

    if (!record) {
      return 'not_found'
    }

    if (isImageActive(record)) {
      return 'active'
    }

    const output = record.outputs.find((item) => {
      return item.id === outputId
    })

    if (!output) {
      return 'not_found'
    }

    const outputs = record.outputs.filter((item) => {
      return item.id !== outputId
    })

    // Save first, unlink second. A crash leaves an orphan file, never a broken record.
    await saveImage({ ...record, outputs })
    await removeImageOutputFile(output)

    if (outputs.length === 0) {
      await deleteImageFiles(record.id)
    }

    return 'deleted'
  })
}

/** Deletes a record and its files. A running record is refused. */
export async function deleteImage(id: string): Promise<DeleteImageResult> {
  return withLock(id, async () => {
    const record = await getImage(id)

    if (!record) {
      return 'not_found'
    }

    if (isImageActive(record)) {
      return 'active'
    }

    cancelScheduledImageSubmit(id)
    await deleteImageFiles(id)

    return 'deleted'
  })
}

/** Removes a record only while its submit is still inside the grace window. */
export async function cancelImage(id: string): Promise<CancelImageResult> {
  return withLock(id, async () => {
    const record = await getImage(id)

    if (!record) {
      return 'not_found'
    }

    const isGrace = record.status === 'submitting' && record.submit?.stage === 'grace'

    if (!isGrace) {
      return 'not_grace'
    }

    cancelScheduledImageSubmit(id)
    await deleteImageFiles(id)

    return 'cancelled'
  })
}
