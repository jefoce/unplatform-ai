'use client'

import { compact, uniq } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord, UploadItem } from '@/core/types'
import { useGeneratorStore } from '@/features/generator/store'
import { errorMessage } from '@/lib/errors'
import { ApiError, apiPatch, apiPost, fetcher } from '@/lib/fetcher'
import { platform } from '@/lib/platform'
import { refreshHistory } from '@/lib/swr-keys'

/** Saves a finished video, surfacing only real saves and failures as a toast. */
export async function saveRecordVideo(record: GenerationRecord): Promise<void> {
  try {
    if (await platform.saveVideo(record)) toast.success('Video saved')
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export async function toggleFavorite(record: GenerationRecord): Promise<void> {
  try {
    await apiPatch(`/api/generations/${record.id}`, { favorite: !record.favorite })
    await refreshHistory()
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Cancels a generation still inside the submit grace window. */
export async function cancelGeneration(id: string): Promise<void> {
  try {
    await apiPost(`/api/generations/${id}/cancel`)
    toast.success('Generation cancelled')
    await refreshHistory()
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      toast.error('Already sent, cannot cancel')
      await refreshHistory()

      return
    }

    toast.error(errorMessage(error))
  }
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

interface GhostUploadsParams {
  record: GenerationRecord
  ids: string[]
  uploads: UploadItem[]
}

/** Rerun ghosts: snapshot entries the uploads API no longer returns. */
function ghostUploads(params: GhostUploadsParams): UploadItem[] {
  const { record, ids, uploads } = params
  const found = new Set(uploads.map((upload) => upload.id))

  return ids
    .filter((id) => !found.has(id))
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
      uploads = await fetcher<UploadItem[]>(
        `/api/uploads?ids=${ids.map(encodeURIComponent).join(',')}`,
      )
    }

    const ghosts = ghostUploads({ record, ids, uploads })

    useGeneratorStore
      .getState()
      .loadInput(
        { ...record.input, presetId: presetId ?? record.input.presetId, seed: record.seedUsed },
        [...uploads, ...ghosts],
      )
    toast.success('Settings loaded')

    if (ghosts.length > 0) toast(`${ghosts.length} inputs no longer exist`)

    const panel = document.getElementById('generator-panel')

    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
