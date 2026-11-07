import type { ModelAvailability } from '../../catalog'
import type { UpaiModel, UpaiSizeMap } from '../../protocol/upai'
import type { CustomEndpoint } from '../../schemas/custom-endpoint'
import type { ImagePreset } from '../image/types'
import { type AspectRatio, type Resolution ,type  VideoPreset } from '../video/types'

export type SizeByAspect = Partial<Record<AspectRatio, `${number}x${number}`>>
export type OutputSizes = Partial<Record<Resolution, SizeByAspect>>

export interface MappedDuration {
  min: number
  max: number
  default: number
  options?: readonly number[]
}

export interface KeepListParams<T extends string> {
  values: readonly string[]
  allowed: readonly T[]
  label: string
}

export interface KeptList<T extends string> {
  kept: T[]
  warnings: string[]
}

export interface MappedVideoContext {
  endpoint: CustomEndpoint
  model: UpaiModel
  availability: ModelAvailability
  maxUploadBytes: number | null
}

export interface MappedImageContext {
  endpoint: CustomEndpoint
  model: UpaiModel
  availability: ModelAvailability
}

export interface ImageParamContext {
  hasResolution: boolean
  hasAspect: boolean
  hasSeed: boolean
  countMax: number
  maxReferences: number
}

export interface DurationResult {
  duration: MappedDuration | null
  warnings: string[]
}

export interface OutputSizesParams {
  sizes: UpaiSizeMap
  resolutions: readonly Resolution[]
  aspects: readonly AspectRatio[]
}

export interface OutputSizesResult {
  sizes: OutputSizes | undefined
  warnings: string[]
}

export interface MapCustomModelParams {
  endpoint: CustomEndpoint
  model: UpaiModel
  maxUploadBytes?: number | null
}

export interface MappedCustomModel {
  preset: VideoPreset | ImagePreset | null
  availability: ModelAvailability
  warnings: string[]
}
