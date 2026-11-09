import type { MediaKindCounts } from '../../media/media-types'
import type { Rule } from '../../provider-errors/types'
import type { BindingBase } from '../common/binding'
import type { PresetIcon } from '../common/icon'
import type { OutputSizes } from '../common/output-sizes'
import type { PresetReferenceLimits } from '../common/reference-limits'

export const IMAGE_RESOLUTIONS = ['512', '768', '1K', '1.5K', '2K', '4K'] as const
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number]

export const IMAGE_ASPECT_RATIOS = [
  '21:9',
  '2:1',
  '16:9',
  '3:2',
  '7:5',
  '4:3',
  '5:4',
  '1:1',
  '4:5',
  '3:4',
  '5:7',
  '2:3',
  '9:16',
  '1:2',
  '9:21',
  '1:8',
  '8:1',
  '1:4',
  '4:1',
  '9:19.5',
  '19.5:9',
  '9:20',
  '20:9',
] as const

export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number]

/** Any aspect string a custom endpoint offers, plus the static list. */
export type ImageAspectChoice = string

export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type ImageQuality = (typeof IMAGE_QUALITIES)[number]

export const IMAGE_BACKGROUNDS = ['auto', 'opaque', 'transparent'] as const
export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number]

export const IMAGE_FAMILIES = ['gemini', 'openai', 'seedream', 'flux', 'custom'] as const
export type ImageFamily = (typeof IMAGE_FAMILIES)[number]

export const IMAGE_PARAMS = [
  'n',
  'aspect_ratio',
  'resolution',
  'quality',
  'background',
  'seed',
  'input_references',
] as const

export type ImageParam = (typeof IMAGE_PARAMS)[number]

/** One control option. `value` is sent to the API, `label` is shown. */
export interface ImageOption<T extends string> {
  value: T
  label: string
}

export interface ImagePreset {
  id: string
  title: string
  family: ImageFamily
  description: string
  workflowName?: string | null

  /** Picker icon, from the existing preset icon set. */
  icon: PresetIcon

  /** null hides the control. */
  resolutions: readonly ImageOption<string>[] | null
  defaultResolution: string | null
  aspectRatios: readonly string[]
  defaultAspectRatio: string
  outputSizes?: OutputSizes

  /** Real output when the provider default is `auto`. Square for GPT Image. */
  autoAspectRatio?: ImageAspectRatio
  qualities: readonly ImageOption<ImageQuality>[] | null
  defaultQuality: ImageQuality | null
  backgrounds: readonly ImageOption<ImageBackground>[] | null
  defaultBackground: ImageBackground | null

  /** Request fields this model accepts. Others are never sent. */
  params: readonly ImageParam[]

  /** Native n the provider accepts in one call. */
  maxN: number
  referenceMax: number
  referenceLimits?: PresetReferenceLimits
  referencesRequired?: MediaKindCounts
  seed: boolean
  promptMaxChars: number

  /** False until a real run proves the model accepts an empty prompt. */
  promptOptional?: boolean

  /** Model-facing label for a reference. `{n}` is the slot number. */
  refLabel: string
  bindings: readonly [BindingBase, ...BindingBase[]]
  errors: readonly Rule[]
}
