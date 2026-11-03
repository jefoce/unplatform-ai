'use client'

import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { UploadItem } from '@/core/schemas/upload-item'
import { applyImageOutputReference } from '@/features/generator/media-actions'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { cancelGrace } from '@/features/shared/cancel-grace'
import { setWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { fetchUploadsByIds } from '@/lib/api/generations'
import {
  cancelImageRequest,
  deleteImageOutput as deleteOutput,
  deleteImageRecord,
  revealImageOutput,
  setOutputFavorite,
} from '@/lib/api/images'
import { markFavoriteChange } from '@/lib/favorite-epoch'
import type { ImageGridItem } from '@/lib/feed/output-items'
import { patchImageFeeds, readImageFeedPages, refreshImages } from '@/lib/image-feed-refresh'
import { favoriteFromPages, patchFavorite } from '@/lib/image-page-patch'
import { createKeyedQueue } from '@/lib/keyed-queue'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

import { imageSaveRefs } from '../selection/selection-actions'

const inFlightFavorites = new Map<string, boolean>()
const favoriteQueue = createKeyedQueue()

/** Cancels an image still inside the submit grace window. */
export function cancelImageGrace(id: string): Promise<void> {
  return cancelGrace({
    request: () => {
      return cancelImageRequest(id)
    },
    refresh: refreshImages,
    successText: 'Image cancelled',
  })
}

export async function favoriteImageItem(item: ImageGridItem): Promise<void> {
  const feeds = await readImageFeedPages()

  const isCurrentFavorite =
    favoriteFromPages({ pages: feeds.flat(), outputId: item.id }) ?? item.favorite

  const isFavorite = !isCurrentFavorite

  if (inFlightFavorites.get(item.id) === isFavorite) {
    return
  }

  inFlightFavorites.set(item.id, isFavorite)
  markFavoriteChange(item.id)

  await patchImageFeeds((pages) => {
    return patchFavorite({ pages, outputId: item.id, favorite: isFavorite })
  })

  await favoriteQueue.run(item.id, async (isLast) => {
    try {
      await setOutputFavorite({ recordId: item.recordId, outputId: item.id, favorite: isFavorite })
    } catch (error) {
      toastError(error)
    } finally {
      if (inFlightFavorites.get(item.id) === isFavorite) {
        inFlightFavorites.delete(item.id)
      }
    }

    if (isLast()) {
      await refreshImages()
    }
  })
}

/** Saves one saved image output, surfacing only real saves and failures as a toast. */
export async function saveImageItem(item: ImageGridItem): Promise<void> {
  const [ref] = imageSaveRefs([item])

  if (isNil(ref)) {
    return
  }

  try {
    const result = await platform.saveImages([ref])

    if (result.saved > 0) {
      toast.success('Image saved')
    }
  } catch (error) {
    toastError(error)
  }
}

/** Deletes one output, or the whole record when it failed before saving. */
export async function deleteImageItem(item: ImageGridItem): Promise<void> {
  if (isNil(item.output)) {
    await deleteImageRecord(item.recordId)
  } else {
    await deleteOutput({ recordId: item.recordId, outputId: item.id })
  }

  await refreshImages()
}

/** Copies the output into uploads and adds it as a video reference. */
export function referenceImageItem(item: ImageGridItem): Promise<boolean> {
  return applyImageOutputReference({ recordId: item.recordId, outputId: item.id })
}

/** Reveals the saved output in the file manager. */
export async function revealImageItem(item: ImageGridItem): Promise<void> {
  try {
    await revealImageOutput({ recordId: item.recordId, outputId: item.id })
  } catch (error) {
    toastError(error)
  }
}

/** Loads the record settings, references and seed into the image generator. */
export async function reuseImagePrompt(item: ImageGridItem): Promise<void> {
  const input = item.source.input
  const store = useImageGeneratorStore.getState()

  try {
    let uploads: UploadItem[] = []

    if (input.references.length > 0) {
      uploads = await fetchUploadsByIds(input.references)
    }

    store.setPreset(input.presetId)
    store.setPrompt(input.prompt)
    store.setCount(input.count)
    store.setAspectRatio(input.aspectRatio)
    store.setResolution(input.resolution)
    store.setQuality(input.quality)
    store.setBackground(input.background)
    store.setSeed(input.seed)
    store.replaceReferences(uploads)

    setWorkspaceTab('image')
    toast.success('Prompt loaded')
  } catch (error) {
    toastError(error)
  }
}
