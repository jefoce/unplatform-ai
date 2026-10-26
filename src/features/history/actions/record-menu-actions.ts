import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { canCancelInGrace } from '@/core/submit-state'
import { useGeneratorStore } from '@/features/generator/store/store'
import { captureGenerationFrame, revealGeneration } from '@/lib/api/generations'
import { linkGenerationFile } from '@/lib/api/uploads'
import { copyText, toastError } from '@/lib/notify'

import { cancelGeneration } from './record-actions'
import { plainPrompt } from './record-view'

/** Grabs the first or last frame of a finished video and arms it as the start frame. */
export async function captureFrame(record: GenerationRecord, at: 'first' | 'last'): Promise<void> {
  try {
    const upload = await captureGenerationFrame(record.id, at)
    const store = useGeneratorStore.getState()

    store.setTab('frames')
    store.setFrame('start', upload)
    toast.success('Start frame set')
  } catch (error) {
    toastError(error)
  }
}

/** Links the finished video as a reference when the preset allows it. */
export async function addReference(record: GenerationRecord): Promise<void> {
  try {
    const upload = await linkGenerationFile({ generationId: record.id })
    const store = useGeneratorStore.getState()

    store.setTab('references')
    store.addReferences([upload])

    if (useGeneratorStore.getState().references.includes(upload.id)) {
      toast.success('Added as reference')
    } else {
      toast.error('Reference limit reached')
    }
  } catch (error) {
    toastError(error)
  }
}

export async function copyPrompt(record: GenerationRecord): Promise<void> {
  await copyText(plainPrompt(record), 'Prompt copied')
}

export async function copySeed(record: GenerationRecord): Promise<void> {
  const seed = record.seedUsed ?? record.input.seed

  if (isNil(seed)) {
    toast.error('No seed recorded')

    return
  }

  await copyText(String(seed), 'Seed copied')
}

export async function revealRecord(record: GenerationRecord): Promise<void> {
  try {
    await revealGeneration(record.id)
  } catch (error) {
    toastError(error)
  }
}

/** Cancels a grace-window record, true means the menu should not open the dialog. */
export function cancelInGrace(record: GenerationRecord): boolean {
  if (!canCancelInGrace(record)) {
    return false
  }

  void cancelGeneration(record.id)

  return true
}
