import type { MediaKind } from '../types'

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

type Transport = 'base64' | 'url' | 'auto'

type PresetFamily = 'wan' | 'seedance'

type PresetIcon = 'sparkles' | 'audio-lines'

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

export interface PricingKeyParams {
  resolution: Resolution
  audio: boolean
  hasVideoInput: boolean
}

export type PresetPricing =
  | {
      kind: 'perSecond'
      unit: 'usd' | 'cents'
      key: (params: PricingKeyParams) => string
      fallback: Record<string, number>

      /** Billed reference-video seconds per input second. */
      referenceVideoFactor: number
    }
  | {
      kind: 'videoTokens'
      fps: number
      key: (params: PricingKeyParams) => string
      fallback: Record<string, number>

      /** Billed reference-video seconds per input second. */
      referenceVideoFactor: number
    }

/** Provider error mapping, filled per family when error handling lands. */
interface ErrorRule {
  match: string | RegExp
  title: string
  hint: string
  kind: string
  retry?: boolean
}

export interface ModelPreset {
  id: string
  title: string
  slug: string
  family: PresetFamily

  /** Key the picker maps to a lucide icon. */
  icon: PresetIcon
  errors: readonly ErrorRule[]
  duration: { min: number; max: number; default: number; options?: readonly number[] }

  /** Provider-billed floor in seconds, independent of the requested duration. */
  minBillableSec?: number
  aspectRatios: readonly AspectRatio[]
  defaultAspectRatio: AspectRatio
  autoAspectWithFrames: boolean

  /** False until a real run proves the model accepts an empty prompt. */
  promptOptional: boolean
  resolutions: readonly Resolution[]
  defaultResolution: Resolution
  audio: { supported: boolean; default: boolean }
  frames: { start: boolean; end: boolean }
  references: {
    image: number
    video: number
    audio: number
    videoTotalSec: number
    audioTotalSec: number
    videoMinSec?: number
    videoMaxSec?: number
    audioMinSec?: number
    audioMaxSec?: number
    audioNeedsVisual?: boolean
  }
  inputTransport: { image: Transport; video: Transport; audio: Transport }
  referenceLimits?: Partial<Record<MediaKind, ReferenceLimits>>
  maxInputPlusOutputSec: number | null
  promptMaxChars: number
  seed: boolean
  refLabel: string
  outputSizes?: Partial<Record<Resolution, Partial<Record<AspectRatio, `${number}x${number}`>>>>
  pricing: PresetPricing
}
