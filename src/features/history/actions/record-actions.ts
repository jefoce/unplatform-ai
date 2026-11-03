'use client'

import { compact, uniq } from 'lodash-es'
import { toast } from 'sonner'

import { extWithDot } from '@/core/media/media-kinds'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { focusGenerator } from '@/features/generator/focus-generator'
import { useGeneratorStore } from '@/features/generator/store/store'
import {
  favoriteFromHistoryPages,
  patchHistoryFavorite,
} from '@/features/history/list/history-pages'
import {
  deleteGeneration,
  fetchUploadsByIds,
  retryDownloadRequest,
  setFavorite,
} from '@/lib/api/generations'
import { markFavoriteChange } from '@/lib/favorite-epoch'
import { ApiError } from '@/lib/fetcher'
import {
  patchHistoryFeeds,
  readHistoryFeedPages,
  refreshHistoryFeeds,
} from '@/lib/history-feed-refresh'
import { createKeyedQueue } from '@/lib/keyed-queue'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

const inFlightFavorites = new Map<string, boolean>()
const favoriteQueue = createKeyedQueue()

/** Deletes one record and refreshes every history page. */
export async function deleteRecord(record: GenerationRecord): Promise<void> {
  await deleteGeneration(record.id)
  await refreshHistoryFeeds()
}

/** Saves a finished video, surfacing only real saves and failures as a toast. */
export async function saveRecordVideo(record: GenerationRecord): Promise<void> {
  try {
    if (await platform.saveVideo(record)) {
      toast.success('Video saved')
    }
  } catch (error) {
    toastError(error)
  }
}

/** Favorite by item id, the output id for images and the record id for video. */
export async function toggleFavoriteId(id: string, isFavorite: boolean): Promise<void> {
  const pages = await readHistoryFeedPages()

  const isCurrentFavorite =
    favoriteFromHistoryPages({ pages: pages.flat(), recordId: id }) ?? isFavorite

  const isNextFavorite = !isCurrentFavorite

  if (inFlightFavorites.get(id) === isNextFavorite) {
    return
  }

  inFlightFavorites.set(id, isNextFavorite)
  markFavoriteChange(id)

  await patchHistoryFeeds((loaded) => {
    return patchHistoryFavorite({ pages: loaded, recordId: id, isFavorite: isNextFavorite })
  })

  await favoriteQueue.run(id, async (isLast) => {
    try {
      await setFavorite(id, isNextFavorite)
    } catch (error) {
      toastError(error)
    } finally {
      if (inFlightFavorites.get(id) === isNextFavorite) {
        inFlightFavorites.delete(id)
      }
    }

    if (isLast()) {
      await refreshHistoryFeeds()
    }
  })
}

export async function toggleFavorite(record: GenerationRecord): Promise<void> {
  await toggleFavoriteId(record.id, record.favorite)
}

/** Re-queues the provider copy of a failed download without paying for a rerun. */
export async function retryDownload(id: string): Promise<void> {
  try {
    await retryDownloadRequest(id)
    toast.success('Download restarted')
    await refreshHistoryFeeds()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error(error.message)
      await refreshHistoryFeeds()

      return
    }

    toastError(error)
  }
}

interface GhostUploadsParams {
  record: GenerationRecord
  ids: string[]
  uploads: UploadItem[]
}

/** Rerun ghosts: snapshot entries the uploads API no longer returns. */
function ghostUploads(params: GhostUploadsParams): UploadItem[] {
  const { record, ids, uploads } = params

  const found = new Set(
    uploads.map((upload) => {
      return upload.id
    }),
  )

  return ids
    .filter((id) => {
      return !found.has(id)
    })
    .map((id) => {
      const item = record.inputsSnapshot[id]

      return {
        id,
        source: item?.source ?? 'file',
        kind: item?.kind ?? 'image',
        mime: '',
        ext: extWithDot(item?.originalName ?? '').slice(1),
        originalName: item?.originalName ?? 'Deleted upload',
        sizeBytes: 0,
        createdAt: record.createdAt,
        missing: true,
      }
    })
}

/** Copies a record input into the generator, reusing the seed actually sent. */
export async function rerunRecord(record: GenerationRecord, presetId?: string): Promise<boolean> {
  const ids = uniq(
    compact([record.input.frames.start, record.input.frames.end, ...record.input.references]),
  )

  try {
    let uploads: UploadItem[] = []

    if (ids.length > 0) {
      uploads = await fetchUploadsByIds(ids)
    }

    const ghosts = ghostUploads({ record, ids, uploads })

    useGeneratorStore
      .getState()
      .loadInput(
        { ...record.input, presetId: presetId ?? record.input.presetId, seed: record.seedUsed },
        [...uploads, ...ghosts],
      )

    toast.success('Settings loaded')

    if (ghosts.length > 0) {
      toast(`${ghosts.length} inputs no longer exist`)
    }

    focusGenerator()

    return true
  } catch (error) {
    toastError(error)

    return false
  }
}
