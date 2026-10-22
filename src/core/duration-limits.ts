import { isNil } from 'lodash-es'

import { minDuration, type ModelPreset } from './presets'
import type { GenerationInput, UploadItem } from './types'

interface ReferenceDurationLimitParams {
  references: readonly string[]
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

interface ReferenceVideoSecondsParams {
  references: readonly string[]
  uploads: Record<string, UploadItem>
}

/** Total seconds of kept video references. */
export function referenceVideoSeconds(params: ReferenceVideoSecondsParams): number {
  const { references, uploads } = params

  return references.reduce((sum, id) => {
    const upload = uploads[id]

    return upload?.kind === 'video' ? sum + (upload.durationSec ?? 0) : sum
  }, 0)
}

/** Numeric duration cap from the total kept video reference time. */
export function durationLimitFor(params: ReferenceDurationLimitParams): number {
  const { references, uploads, preset } = params

  if (isNil(preset.maxInputPlusOutputSec)) return preset.duration.max

  const total = referenceVideoSeconds({ references, uploads })

  if (total === 0 || Number.isNaN(total)) return preset.duration.max

  const room = Math.floor(preset.maxInputPlusOutputSec - total)

  return Math.max(minDuration(preset), Math.min(preset.duration.max, room))
}

interface MaxDurationForParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

/** Longest allowed output duration, capped by references. */
export function maxDurationFor(params: MaxDurationForParams): number {
  const { input, uploads, preset } = params

  if (isNil(preset.maxInputPlusOutputSec)) return preset.duration.max

  let references: string[] = []

  if (input.tab === 'references') references = input.references

  return durationLimitFor({ references, uploads, preset })
}
