import { maxDurationFor, referenceVideoSeconds } from '@/core/duration-limits'
import { minDuration } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import type { UploadsById } from '@/core/schemas/upload-item'
import { formatSecondsExact } from '@/lib/format'

import { type GeneratorDraft, inputFromState } from '../store/store-draft'

interface DurationLimitParams {
  draft: GeneratorDraft
  uploadsById: UploadsById
  preset: ModelPreset
}

/** Duration bounds and copy for the current draft and reference videos. */
export function durationLimit(params: DurationLimitParams) {
  const { draft, uploadsById, preset } = params

  const { max } = preset.duration
  const min = minDuration(preset)

  const limit = maxDurationFor({
    input: inputFromState(draft),
    uploads: uploadsById,
    preset,
  })

  const chips = (preset.duration.options ?? []).filter((value) => {
    return value >= min && value <= max
  })

  const isFloored = min > preset.duration.min

  const totalVideo = referenceVideoSeconds({
    references: draft.references,
    uploads: uploadsById,
  })

  const isCapped = limit < max
  const limitText = `Up to ${limit}s with ${formatSecondsExact(totalVideo)} of reference video`

  return { min, limit, chips, isFloored, isCapped, limitText }
}
