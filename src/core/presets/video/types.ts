import type { MediaKindCounts } from '../../media/media-types'
import type { Rule } from '../../provider-errors/types'
import type { ProviderBinding } from '../common/binding'
import type { PresetIcon } from '../common/icon'
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
export type AspectChoice = AspectRatio | 'auto'

export const VIDEO_FAMILIES = ['wan', 'seedance'] as const

export type VideoFamily = (typeof VIDEO_FAMILIES)[number]

type SizeByAspect = Partial<Record<AspectRatio, `${number}x${number}`>>

interface PresetDuration {
  min: number
  max: number
  default: number
  options?: readonly number[]
}

interface PresetAudio {
  supported: boolean
  default: boolean
}

interface PresetFrames {
  start: boolean
  end: boolean
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

  /** Key the picker maps to a lucide icon. */
  icon: PresetIcon
  duration: PresetDuration

  aspectRatios: readonly AspectRatio[]
  defaultAspectRatio: AspectRatio
  autoAspectWithFrames: boolean

  /** False until a real run proves the model accepts an empty prompt. */
  promptOptional: boolean
  resolutions: readonly Resolution[]
  defaultResolution: Resolution
  audio: PresetAudio
  frames: PresetFrames
  references: PresetReferences
  referenceLimits?: PresetReferenceLimits
  maxInputPlusOutputSec: number | null
  promptMaxChars: number
  seed: boolean
  refLabel: string
  outputSizes?: Partial<Record<Resolution, SizeByAspect>>
  bindings: readonly [ProviderBinding, ...ProviderBinding[]]
  errors: readonly Rule[]
}
