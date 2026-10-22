import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/lib/platform'

import { batchAction } from './batch-actions'
import { revalidateHistory } from './history-pages'

const pluralVideos = (count: number): string => `${count} ${count === 1 ? 'video' : 'videos'}`

/** Saves one or many completed videos, platform dialogs own the prompts. */
export async function downloadSelected(selected: GenerationRecord[]): Promise<void> {
  try {
    if (selected.length === 1) {
      const isSaved = await platform.saveVideo(selected[0])

      if (!isSaved) return

      toast.success('Video saved')

      return
    }

    const result = await platform.saveVideos(selected)

    if (result.saved === 0) return

    if (!isNil(result.folder) && result.folder !== '') {
      toast.success(`${pluralVideos(result.saved)} saved to ${result.folder}`)

      return
    }

    toast.success(
      result.saved === 1
        ? 'Download started'
        : `${result.saved} downloads started. Allow multiple downloads if asked.`,
    )
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export async function likeSelected(
  selected: GenerationRecord[],
  isFavorite: boolean,
): Promise<void> {
  const result = await batchAction(
    selected.map((record) => record.id),
    { action: 'favorite', favorite: isFavorite },
  )

  toast.success(isFavorite ? `Liked ${result.done.length}` : `Unliked ${result.done.length}`)
  await revalidateHistory()
}

export function confirmDelete(selected: GenerationRecord[]): Promise<boolean> {
  const count = selected.length

  return platform.confirm(
    `Delete ${count} video${count === 1 ? '' : 's'}? The files are removed from your computer.`,
  )
}

export async function deleteSelected(selected: GenerationRecord[]): Promise<void> {
  const result = await batchAction(
    selected.map((record) => record.id),
    { action: 'delete' },
  )
  const skippedActive = result.skipped.filter((item) => item.reason === 'active').length
  const skippedText = `${skippedActive} still generating ${skippedActive === 1 ? 'was' : 'were'} skipped`

  if (result.done.length > 0) {
    toast.success(
      skippedActive > 0
        ? `Deleted ${result.done.length}. ${skippedText}.`
        : `Deleted ${result.done.length}`,
    )
  } else {
    toast.error(skippedActive > 0 ? `Nothing deleted. ${skippedText}.` : 'Nothing deleted')
  }

  await revalidateHistory()
}
