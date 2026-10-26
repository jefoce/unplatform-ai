import type { MediaKind, MediaKindCounts } from '../media-types'
import type { VideoProviderId } from '../providers/types'
import type { Dict } from '../utility-types'

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

/** @public */
export const RESOLVED_TRANSPORTS = ['base64', 'url'] as const

/** @public */
export const TRANSPORTS = [...RESOLVED_TRANSPORTS, 'auto'] as const

/** @public */
export type Transport = (typeof TRANSPORTS)[number]

/** @public */
export interface TransportByKind {
  image: Transport
  video: Transport
  audio: Transport
}

export const PRESET_FAMILIES = ['wan', 'seedance'] as const

export type PresetFamily = (typeof PRESET_FAMILIES)[number]

export const PRESET_ICONS = ['sparkles', 'audio-lines'] as const

export type PresetIcon = (typeof PRESET_ICONS)[number]

export interface ReferenceLimits {
  maxBytes?: number
  minSidePx?: number
  maxSidePx?: number

  /** Lowercase extensions, no dot. */
  formats?: readonly string[]

  /** Long side / short side. */
  maxAspect?: number

  /** Model keeps transparency in a PNG. False means flatten before JPEG. */
  alpha?: boolean
}

export type SkuTable = Readonly<Dict<number>>
export type ResolutionTiers = Readonly<Partial<Record<Resolution, string>>>

type SizeByAspect = Partial<Record<AspectRatio, `${number}x${number}`>>

export type PresetReferenceLimits = Partial<Record<MediaKind, ReferenceLimits>>

export interface SkuContext {
  resolution: Resolution
  audio: boolean
  hasVideoInput: boolean
}

export interface SkuCondition {
  hasVideoInput?: boolean
  audio?: boolean
  hasTier?: boolean
}

/** First rule whose every set condition matches wins. `{resolution}` and `{tier}` are replaced. */
export interface SkuRule {
  when: SkuCondition
  key: string
}

export interface PerSecondPricing {
  kind: 'perSecond'
  unit: 'usd' | 'cents'
  skuRules: readonly SkuRule[]
  tiers: ResolutionTiers
  fallback: SkuTable
  minBillableSec: number

  /** Billed reference-video seconds per input second. */
  referenceVideoFactor: number
}

export interface VideoTokenPricing {
  kind: 'videoTokens'
  fps: number
  skuRules: readonly SkuRule[]
  tiers: ResolutionTiers
  fallback: SkuTable
  minBillableSec: number

  /** Billed reference-video seconds per input second. */
  referenceVideoFactor: number
}

export type PricingRule = PerSecondPricing | VideoTokenPricing

export interface ProviderBinding {
  provider: VideoProviderId
  modelId: string
  pricing: PricingRule
  transport: TransportByKind
}

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

export interface ModelPreset {
  id: string
  title: string
  family: PresetFamily

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
}
