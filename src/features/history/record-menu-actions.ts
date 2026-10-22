import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { canCancelInGrace } from '@/core/submit-state'
import type { GenerationRecord, UploadItem } from '@/core/types'
import { useGeneratorStore } from '@/features/generator/store'
import { errorMessage } from '@/lib/errors'
import { apiPost } from '@/lib/fetcher'

import { cancelGeneration } from './record-actions'
import { plainPrompt } from './record-view'

/** Grabs the first or last frame of a finished video and arms it as the start frame. */
export async function captureFrame(record: GenerationRecord, at: 'first' | 'last'): Promise<void> {
  try {
    const upload = await apiPost<UploadItem>(`/api/generations/${record.id}/frame`, { at })
    const store = useGeneratorStore.getState()

    store.setTab('frames')
    store.setFrame('start', upload)
    toast.success('Start frame set')
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Links the finished video as a reference when the preset allows it. */
export async function addReference(record: GenerationRecord): Promise<void> {
  try {
    const upload = await apiPost<UploadItem>('/api/uploads/link', { generationId: record.id })
    const store = useGeneratorStore.getState()

    store.setTab('references')
    store.addReferences([upload])

    if (useGeneratorStore.getState().references.includes(upload.id))
      toast.success('Added as reference')
    else toast.error('Reference limit reached')
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

export async function copyPrompt(record: GenerationRecord): Promise<void> {
  try {
    await navigator.clipboard.writeText(plainPrompt(record))
    toast.success('Prompt copied')
  } catch {
    toast.error('Copy failed')
  }
}

export async function copySeed(record: GenerationRecord): Promise<void> {
  const seed = record.seedUsed ?? record.input.seed

  if (isNil(seed)) {
    toast.error('No seed recorded')

    return
  }

  try {
    await navigator.clipboard.writeText(String(seed))
    toast.success('Seed copied')
  } catch {
    toast.error('Copy failed')
  }
}

export async function revealRecord(record: GenerationRecord): Promise<void> {
  try {
    await apiPost(`/api/generations/${record.id}/reveal`)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

/** Cancels a grace-window record, true means the menu should not open the dialog. */
export function cancelInGrace(record: GenerationRecord): boolean {
  if (!canCancelInGrace(record)) return false

  void cancelGeneration(record.id)

  return true
}
