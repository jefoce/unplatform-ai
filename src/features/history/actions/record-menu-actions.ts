import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { canCancelInGrace } from '@/core/submit-state'
import {
  applyRecordToGenerator,
  captureFrameAt,
  linkRecordReference,
} from '@/features/generator/record-input'
import { useGeneratorStore } from '@/features/generator/store/store'
import { revealGeneration } from '@/lib/api/generations'
import { copyText, toastError } from '@/lib/notify'

import { cancelGeneration } from './record-actions'
import { plainPrompt } from './record-view'

/** Grabs the first or last frame of a finished video and arms it as the start frame. */
export async function captureFrame(
  record: GenerationRecord,
  at: 'first' | 'last',
): Promise<boolean> {
  try {
    await captureFrameAt(record, at)
    toast.success('Start frame set')

    return true
  } catch (error) {
    toastError(error)

    return false
  }
}

/** Links the finished video as a reference when the preset allows it. */
export async function addReference(record: GenerationRecord): Promise<boolean> {
  try {
    const upload = await linkRecordReference(record)
    const isAdded = useGeneratorStore.getState().references.includes(upload.id)

    if (isAdded) {
      toast.success('Added as reference')
    } else {
      toast.error('Reference limit reached')
    }

    return isAdded
  } catch (error) {
    toastError(error)

    return false
  }
}

/**
 * Applies a record as input for the active generator tab.
 * @public
 */
export async function applyRecordInput(record: GenerationRecord): Promise<boolean> {
  try {
    return await applyRecordToGenerator(record)
  } catch (error) {
    toastError(error)

    return false
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
