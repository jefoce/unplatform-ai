'use client'

import { compact, uniq } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { useGeneratorStore } from '@/features/generator/store/store'
import { cancelGenerationRequest, fetchUploadsByIds, setFavorite } from '@/lib/api/generations'
import { ApiError } from '@/lib/fetcher'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'
import { refreshHistory } from '@/lib/swr-keys'

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

export async function toggleFavorite(record: GenerationRecord): Promise<void> {
  try {
    await setFavorite(record.id, !record.favorite)
    await refreshHistory()
  } catch (error) {
    toastError(error)
  }
}

/** Cancels a generation still inside the submit grace window. */
export async function cancelGeneration(id: string): Promise<void> {
  try {
    await cancelGenerationRequest(id)
    toast.success('Generation cancelled')
    await refreshHistory()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error('Already sent, cannot cancel')
      await refreshHistory()

      return
    }

    toastError(error)
  }
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')

  if (dot > 0) {
    return name.slice(dot + 1).toLowerCase()
  }

  return ''
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
        ext: extensionOf(item?.originalName ?? ''),
        originalName: item?.originalName ?? 'Deleted upload',
        sizeBytes: 0,
        createdAt: record.createdAt,
        missing: true,
      }
    })
}

/** Copies a record input into the generator, reusing the seed actually sent. */
export async function rerunRecord(record: GenerationRecord, presetId?: string): Promise<void> {
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

    const panel = document.getElementById('generator-panel')

    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (error) {
    toastError(error)
  }
}
