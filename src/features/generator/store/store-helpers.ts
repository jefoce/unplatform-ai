import { clamp, isNil, sumBy } from 'lodash-es'
import { toast } from 'sonner'

import { SEED_MAX } from '@/core/constants'
import { maxDurationFor } from '@/core/duration-limits'
import { isNonEmptyString } from '@/core/guards'
import type { MediaKind, MediaKindCounts } from '@/core/media-types'
import { minDuration } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import { idForSlot, referenceSlots, type RefSlot } from '@/core/prompt-tokens'
import type { GenerationInput, GeneratorTab } from '@/core/schemas/generation-record'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import { formatSecondsExact } from '@/lib/format'

interface ReferenceState {
  references: string[]
  uploadsById: UploadsById
}

interface TabReferenceState extends ReferenceState {
  tab: GeneratorTab
}

/** True when the references tab holds at least one video upload. */
export function hasVideoReference(state: TabReferenceState): boolean {
  return (
    state.tab === 'references' &&
    state.references.some((id) => {
      return state.uploadsById[id]?.kind === 'video'
    })
  )
}

export const randomSeed = (): number => {
  return Math.floor(Math.random() * (SEED_MAX + 1))
}

/** Attached references counted per kind in API order. */
export function slotCounts(state: ReferenceState): MediaKindCounts {
  return referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  }).counts
}

/** Upload attached at a 1-based slot, resolved live from reference order. */
export function uploadForSlot(state: ReferenceState, slot: RefSlot): UploadItem | undefined {
  const { slots } = referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  })

  const id = idForSlot(slots, slot)

  if (!isNonEmptyString(id)) {
    return undefined
  }

  return state.uploadsById[id]
}

interface ClampReferenceDurationParams {
  input: GenerationInput
  uploads: UploadsById
  preset: ModelPreset
}

/** Lower duration to the reference-video limit, toast when it changed. */
export function clampReferenceDuration(params: ClampReferenceDurationParams): number {
  const { input, uploads, preset } = params
  const limit = maxDurationFor({ input, uploads, preset })
  const duration = clamp(input.duration, minDuration(preset), limit)

  if (duration === input.duration) {
    return duration
  }

  const totalVideo = sumBy(input.references, (id) => {
    const upload = uploads[id]

    if (upload?.kind === 'video') {
      return upload.durationSec ?? 0
    }

    return 0
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
  uploads: UploadsById,
): Record<MediaKind, number> {
  const counts: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 }

  for (const id of ids) {
    if (!isNil(uploads[id])) {
      counts[uploads[id].kind] += 1
    }
  }

  return counts
}
