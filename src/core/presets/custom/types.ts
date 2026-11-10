import type { ModelAvailability } from '../../catalog'
import type { UpaiModel, UpaiSizeMap } from '../../protocol/upai'
import type { CustomEndpoint } from '../../schemas/custom-endpoint'
import type { OutputSizes } from '../common/output-sizes'
import type { ImagePreset } from '../image/types'
import type { VideoPreset } from '../video/types'

export interface MappedDuration {
  min: number
  max: number
  default: number
  step?: number
  options?: readonly number[]
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
  resolutions: readonly string[]
  aspects: readonly string[]
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
