import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { ImageOutputRef } from '@/core/api/image'
import { isNonEmptyString } from '@/core/guards'
import {
  type HistoryItem,
  type ImageGridItem,
  isImageItem,
  isVideoItem,
  type VideoGridItem,
} from '@/lib/feed/output-items'
import { refreshHistoryFeeds } from '@/lib/history-feed-refresh'
import { refreshImages } from '@/lib/image-feed-refresh'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'
import type { ImageSaveRef, SaveResult } from '@/lib/platform/types'

import { batchAction, batchImageAction } from './batch-actions'

interface SelectionSplit {
  videos: VideoGridItem[]
  images: ImageGridItem[]
}

function splitSelection(items: HistoryItem[]): SelectionSplit {
  return {
    videos: items.filter(isVideoItem),
    images: items.filter(isImageItem),
  }
}

function imageRefs(items: ImageGridItem[]): ImageOutputRef[] {
  return items.map((item) => {
    if (isNil(item.output)) {
      return { recordId: item.recordId, outputId: null }
    }

    return { recordId: item.recordId, outputId: item.id }
  })
}

/** Saved image outputs as platform save refs, skipping unfinished outputs. */
export function imageSaveRefs(items: ImageGridItem[]): ImageSaveRef[] {
  return items.flatMap((item): ImageSaveRef[] => {
    if (item.output?.status !== 'saved') {
      return []
    }

    return [{ recordId: item.recordId, outputId: item.id, file: item.output.file }]
  })
}

/** Completed videos and saved image outputs have a file to download. */
export function isDownloadable(item: HistoryItem): boolean {
  if (isVideoItem(item)) {
    return item.status === 'completed'
  }

  return item.output?.status === 'saved'
}

async function refreshSelection(split: SelectionSplit): Promise<void> {
  const tasks: Promise<unknown>[] = []

  if (split.videos.length > 0) {
    tasks.push(refreshHistoryFeeds())
  }

  if (split.images.length > 0) {
    tasks.push(refreshImages())
  }

  await Promise.all(tasks)
}

const plural = (count: number, noun: 'image' | 'video'): string => {
  const word = count === 1 ? noun : `${noun}s`

  return `${count} ${word}`
}

/** Reports what was saved and what the batch route skipped. */
function reportSaveResult(result: SaveResult, noun: 'image' | 'video'): void {
  if (result.saved === 0 && result.skipped === 0) {
    return
  }

  if (result.saved > 0) {
    reportSaved(result, noun)
  }

  if (result.skipped > 0) {
    toast.error(`${plural(result.skipped, noun)} could not be saved`)
  }
}

function reportSaved(result: SaveResult, noun: 'image' | 'video'): void {
  if (isNonEmptyString(result.folder)) {
    toast.success(`${plural(result.saved, noun)} saved to ${result.folder}`)

    return
  }

  const startedText =
    result.saved === 1
      ? 'Download started'
      : `${result.saved} downloads started. Allow multiple downloads if asked.`

  toast.success(startedText)
}

interface SaveCompletedParams {
  split: SelectionSplit
  isSingleSelection: boolean
}

async function saveSingleVideo(params: SaveCompletedParams): Promise<boolean> {
  const { split, isSingleSelection } = params

  if (!isSingleSelection || split.images.length > 0 || split.videos.length !== 1) {
    return false
  }

  const [item] = split.videos

  if (isNil(item)) {
    return false
  }

  const isSaved = await platform.saveVideo(item.source)

  if (isSaved) {
    toast.success('Video saved')
  }

  return true
}

async function saveCompleted(params: SaveCompletedParams): Promise<void> {
  const { split, isSingleSelection } = params

  if (await saveSingleVideo({ split, isSingleSelection })) {
    return
  }

  if (split.videos.length > 0) {
    const records = split.videos.map((item) => {
      return item.source
    })

    reportSaveResult(await platform.saveVideos(records), 'video')
  }

  if (split.images.length > 0) {
    reportSaveResult(await platform.saveImages(imageSaveRefs(split.images)), 'image')
  }
}

/** Saves completed videos and saved image outputs, platform dialogs own the prompts. */
export async function downloadSelected(items: HistoryItem[]): Promise<void> {
  const completed = items.filter(isDownloadable)
  const skipped = items.length - completed.length

  if (skipped > 0) {
    toast(`${skipped} not finished, skipped`)
  }

  if (completed.length === 0) {
    return
  }

  const split = splitSelection(completed)
  const isSingleSelection = items.length === 1

  try {
    await saveCompleted({ split, isSingleSelection })
  } catch (error) {
    toastError(error)
  }
}

export function confirmDelete(items: HistoryItem[]): Promise<boolean> {
  const { videos, images } = splitSelection(items)
  const count = items.length
  const suffix = count === 1 ? '' : 's'
  const isImageSelection = images.length > 0 && videos.length === 0
  const noun = isImageSelection ? 'image' : 'video'

  return platform.confirm(
    `Delete ${count} ${noun}${suffix}? The files are removed from your computer.`,
  )
}

export async function deleteSelected(items: HistoryItem[]): Promise<void> {
  const split = splitSelection(items)

  const [videoResult, imageResult] = await Promise.all([
    batchAction(
      split.videos.map((item) => {
        return item.id
      }),
      { action: 'delete' },
    ),
    batchImageAction(imageRefs(split.images), { action: 'delete' }),
  ])

  const done = [...videoResult.done, ...imageResult.done]
  const skipped = [...videoResult.skipped, ...imageResult.skipped]

  const skippedActive = skipped.filter((item) => {
    return item.reason === 'active'
  }).length

  const verb = skippedActive === 1 ? 'was' : 'were'
  const skippedText = `${skippedActive} still generating ${verb} skipped`

  if (done.length > 0) {
    const successText =
      skippedActive > 0 ? `Deleted ${done.length}. ${skippedText}.` : `Deleted ${done.length}`

    toast.success(successText)
  } else {
    const errorText = skippedActive > 0 ? `Nothing deleted. ${skippedText}.` : 'Nothing deleted'

    toast.error(errorText)
  }

  await refreshSelection(split)
}
