import { isNil } from 'lodash-es'

import { IMAGE_REFERENCE_MAX_MB, IMAGE_REFERENCE_MAX_SIDE_PX } from '../../constants'
import type { PricingConfig, SkuRule, TokenRule } from '../../pricing/types'
import type { Dict } from '../../utility-types'
import type {
  ImageAspectChoice,
  ImageBackground,
  ImageOption,
  ImageQuality,
  ImageResolution,
} from '../image/types'

export const IMAGE_PROMPT_MAX_CHARS = 5000

/** Option labels live here so no component maps a value to a label. */
const QUALITY_LABELS = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
  max: 'Max',
} as const satisfies Record<ImageQuality, string>

const BACKGROUND_LABELS = {
  auto: 'Auto',
  opaque: 'Opaque',
  transparent: 'Transparent',
} as const satisfies Record<ImageBackground, string>

export const imageResolutionOptions = (
  values: readonly ImageResolution[],
): readonly ImageOption<ImageResolution>[] => {
  return values.map((value) => {
    return { value, label: value }
  })
}

export const imageQualityOptions = (
  values: readonly ImageQuality[],
): readonly ImageOption<ImageQuality>[] => {
  return values.map((value) => {
    return { value, label: QUALITY_LABELS[value] }
  })
}

export const imageBackgroundOptions = (
  values: readonly ImageBackground[],
): readonly ImageOption<ImageBackground>[] => {
  return values.map((value) => {
    return { value, label: BACKGROUND_LABELS[value] }
  })
}

interface TokenPricingParams {
  outputUsd: number
  inputImageUsd?: number
  inputTextUsd?: number

  /** Used only when no per-context rules are given. */
  outputTokens?: number
  outputTokenRules?: readonly [TokenRule, ...TokenRule[]]
  referenceTokens: number
}

/** Token estimate. Prompt tokens use four characters per token, an estimate. */
export const tokenPricing = (params: TokenPricingParams): PricingConfig => {
  const {
    outputUsd,
    inputImageUsd,
    inputTextUsd,
    outputTokens,
    outputTokenRules,
    referenceTokens,
  } = params

  if (isNil(outputTokenRules) && isNil(outputTokens)) {
    throw new Error('token pricing needs outputTokens or outputTokenRules')
  }

  const output: readonly [TokenRule, ...TokenRule[]] = outputTokenRules ?? [
    { when: {}, tokens: outputTokens ?? 0 },
  ]

  const fallback: Dict<number> = { output_image_base_token: outputUsd }

  if (!isNil(inputImageUsd)) {
    fallback.input_image_base_token = inputImageUsd
  }

  if (!isNil(inputTextUsd)) {
    fallback.input_text_base_token = inputTextUsd
  }

  return {
    formula: 'imageTokens',
    skuRules: [{ when: {}, key: 'output_image_base_token' }],
    fallback,
    tokens: { output, reference: referenceTokens },
  }
}

interface ImagePricingParams {
  skuRules: readonly SkuRule[]
  fallback: Dict<number>
}

/** Rate per output image. Variants select the resolution line. */
export const imagePricing = (params: ImagePricingParams): PricingConfig => {
  const { skuRules, fallback } = params

  return { formula: 'perImage', skuRules, fallback }
}

/** Aspect ratios every Gemini model can accept, plus the two narrower lists. */
export const GEMINI_RATIOS_WIDE: readonly ImageAspectChoice[] = [
  '1:1',
  '1:4',
  '1:8',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
]

export const GEMINI_RATIOS_STANDARD: readonly ImageAspectChoice[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
]

/** Shared reference limits for image models. Alpha stays off until a real PNG passes. */
export const IMAGE_REFERENCE_LIMITS = {
  image: {
    formats: ['jpg', 'jpeg', 'png', 'webp'],
    maxSidePx: IMAGE_REFERENCE_MAX_SIDE_PX,
    maxBytes: IMAGE_REFERENCE_MAX_MB * 1024 * 1024,
    alpha: false,
  },
} as const
