import type { MediaKind, MediaKindCounts } from '../../media/media-types'
import type { Rule } from '../../provider-errors/types'
import type { ProviderBinding } from '../common/binding'
import type { PresetIcon } from '../common/icon'
import type { OutputSizes } from '../common/output-sizes'
import type { PresetReferenceLimits } from '../common/reference-limits'

export const RESOLUTIONS = ['480p', '720p', '768p', '1080p', '2K', '4K'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '1:1',
  '3:4',
  '2:3',
  '9:16',
  '9:21',
] as const

export type AspectRatio = (typeof ASPECT_RATIOS)[number]

/** Any aspect string a custom endpoint offers, plus the static list. */
export type AspectChoice = string

export const VIDEO_FAMILIES = ['wan', 'seedance', 'custom'] as const

export type VideoFamily = (typeof VIDEO_FAMILIES)[number]

interface PresetDuration {
  min: number
  max: number
  default: number
  step?: number
  options?: readonly number[]
}

interface PresetAudio {
  supported: boolean
  default: boolean
}

interface PresetFrames {
  start: boolean
  end: boolean
  startRequired?: boolean
  endRequired?: boolean
}

interface PresetReferences extends MediaKindCounts {
  videoTotalSec: number
  audioTotalSec: number
  videoMinSec?: number
  videoMaxSec?: number
  audioMinSec?: number
  audioMaxSec?: number
  audioNeedsVisual?: boolean
}

export interface VideoPreset {
  id: string
  title: string
  family: VideoFamily
  description?: string
  workflowName?: string | null

  /** Key the picker maps to a lucide icon. */
  icon: PresetIcon
  duration: PresetDuration

  aspectRatios: readonly string[]
  defaultAspectRatio: string
  autoAspectWithFrames: boolean

  /** False until a real run proves the model accepts an empty prompt. */
  promptOptional: boolean
  resolutions: readonly string[]
  defaultResolution: string
  audio: PresetAudio
  frames: PresetFrames
  references: PresetReferences
  referencesRequired?: MediaKindCounts
  referenceLimits?: PresetReferenceLimits
  maxInputPlusOutputSec: number | null
  promptMaxChars: number
  seed: boolean
  refLabel: string
  refLabels?: Partial<Record<MediaKind, string>>
  outputSizes?: OutputSizes
  bindings: readonly [ProviderBinding, ...ProviderBinding[]]
  errors: readonly Rule[]
}
