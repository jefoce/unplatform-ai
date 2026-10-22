import { clamp, isNil, sumBy } from 'lodash-es'
import { toast } from 'sonner'

import { SEED_MAX } from '@/core/constants'
import { minDuration, type ModelPreset } from '@/core/presets'
import { idForSlot, referenceSlots, type RefSlot, type SlotCounts } from '@/core/prompt-tokens'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'
import { maxDurationFor } from '@/core/validation'
import { formatSecondsExact } from '@/lib/format'

interface ReferenceState {
  references: string[]
  uploadsById: Record<string, UploadItem>
}

export const randomSeed = (): number => Math.floor(Math.random() * (SEED_MAX + 1))

/** Attached references counted per kind in API order. */
export function slotCounts(state: ReferenceState): SlotCounts {
  return referenceSlots(state.references, (id) => state.uploadsById[id]?.kind).counts
}

/** Upload attached at a 1-based slot, resolved live from reference order. */
export function uploadForSlot(state: ReferenceState, slot: RefSlot): UploadItem | undefined {
  const { slots } = referenceSlots(state.references, (id) => state.uploadsById[id]?.kind)
  const id = idForSlot(slots, slot)

  return isNil(id) || id === '' ? undefined : state.uploadsById[id]
}

interface ClampReferenceDurationParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

/** Lower duration to the reference-video limit, toast when it changed. */
export function clampReferenceDuration(params: ClampReferenceDurationParams): number {
  const { input, uploads, preset } = params
  const limit = maxDurationFor({ input, uploads, preset })
  const duration = clamp(input.duration, minDuration(preset), limit)

  if (duration === input.duration) return duration

  const totalVideo = sumBy(input.references, (id) => {
    const upload = uploads[id]

    return upload?.kind === 'video' ? (upload.durationSec ?? 0) : 0
  })

  if (duration < input.duration && totalVideo > 0) {
    toast(
      `Duration set to ${duration}s (${formatSecondsExact(totalVideo)} of reference video, max ${preset.maxInputPlusOutputSec}s total)`,
    )
  }

  return duration
}

export function kindCounts(
  ids: readonly string[],
  uploads: Record<string, UploadItem>,
): Record<MediaKind, number> {
  const counts: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 }

  for (const id of ids) if (!isNil(uploads[id])) counts[uploads[id].kind] += 1

  return counts
}
