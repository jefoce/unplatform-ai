import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

import { revalidateHistory } from '../list/history-pages'
import { batchAction } from './batch-actions'

const pluralVideos = (count: number): string => {
  const word = count === 1 ? 'video' : 'videos'

  return `${count} ${word}`
}

/** Saves one or many completed videos, platform dialogs own the prompts. */
export async function downloadSelected(selected: GenerationRecord[]): Promise<void> {
  try {
    const [single] = selected

    if (!isNil(single) && selected.length === 1) {
      const isSaved = await platform.saveVideo(single)

      if (!isSaved) {
        return
      }

      toast.success('Video saved')

      return
    }

    const result = await platform.saveVideos(selected)

    if (result.saved === 0) {
      return
    }

    if (isNonEmptyString(result.folder)) {
      toast.success(`${pluralVideos(result.saved)} saved to ${result.folder}`)

      return
    }

    const startedText =
      result.saved === 1
        ? 'Download started'
        : `${result.saved} downloads started. Allow multiple downloads if asked.`

    toast.success(startedText)
  } catch (error) {
    toastError(error)
  }
}

export async function likeSelected(
  selected: GenerationRecord[],
  isFavorite: boolean,
): Promise<void> {
  const result = await batchAction(
    selected.map((record) => {
      return record.id
    }),
    { action: 'favorite', favorite: isFavorite },
  )

  const text = isFavorite ? `Liked ${result.done.length}` : `Unliked ${result.done.length}`

  toast.success(text)
  await revalidateHistory()
}

export function confirmDelete(selected: GenerationRecord[]): Promise<boolean> {
  const count = selected.length
  const suffix = count === 1 ? '' : 's'

  return platform.confirm(
    `Delete ${count} video${suffix}? The files are removed from your computer.`,
  )
}

export async function deleteSelected(selected: GenerationRecord[]): Promise<void> {
  const result = await batchAction(
    selected.map((record) => {
      return record.id
    }),
    { action: 'delete' },
  )

  const skippedActive = result.skipped.filter((item) => {
    return item.reason === 'active'
  }).length

  const verb = skippedActive === 1 ? 'was' : 'were'
  const skippedText = `${skippedActive} still generating ${verb} skipped`

  if (result.done.length > 0) {
    const successText =
      skippedActive > 0
        ? `Deleted ${result.done.length}. ${skippedText}.`
        : `Deleted ${result.done.length}`

    toast.success(successText)
  } else {
    const errorText = skippedActive > 0 ? `Nothing deleted. ${skippedText}.` : 'Nothing deleted'

    toast.error(errorText)
  }

  await revalidateHistory()
}
