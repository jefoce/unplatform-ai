import type { TokenRule } from '../../../pricing/types'
import {
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  imageBackgroundOptions,
  imageQualityOptions,
} from '../../common/options'
import type { ImageAspectChoice, ImagePreset } from '../types'
import { OPENAI_ERRORS } from './errors'

/** GPT Image accepts these ratios, plus auto on every model. */
const OPENAI_RATIOS: readonly ImageAspectChoice[] = [
  '1:1',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
  '21:9',
  'auto',
]

export const OPENAI_QUALITIES_25 = imageQualityOptions([
  'auto',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
])

export const OPENAI_QUALITIES_2 = imageQualityOptions(['auto', 'low', 'medium', 'high'])

export const OPENAI_BACKGROUNDS_25 = imageBackgroundOptions(['auto', 'transparent', 'opaque'])

/**
 * GPT Image 2 output tokens by quality and aspect. Square low is measured:
 * real-key gpt-image-2 at 1024x1024 returned 196 tokens. The rest are OpenAI
 * table estimates. Source: OpenAI image generation pricing/token table
 * https://platform.openai.com/docs/guides/image-generation (read 2026-10-29).
 */
export const GPT_IMAGE_2_OUTPUT_TOKEN_RULES = [
  { when: { quality: 'low', aspect: 'square' }, tokens: 196 },
  { when: { quality: 'medium', aspect: 'square' }, tokens: 1056 },
  { when: { quality: 'high', aspect: 'square' }, tokens: 4160 },
  { when: { quality: 'auto', aspect: 'square' }, tokens: 1056 },
  { when: { quality: 'low', aspect: 'wide' }, tokens: 408 },
  { when: { quality: 'low', aspect: 'tall' }, tokens: 408 },
  { when: { quality: 'medium', aspect: 'wide' }, tokens: 1584 },
  { when: { quality: 'medium', aspect: 'tall' }, tokens: 1584 },
  { when: { quality: 'high', aspect: 'wide' }, tokens: 6240 },
  { when: { quality: 'high', aspect: 'tall' }, tokens: 6240 },
  { when: { quality: 'auto', aspect: 'wide' }, tokens: 1584 },
  { when: { quality: 'auto', aspect: 'tall' }, tokens: 1584 },
  { when: {}, tokens: 1056 },
] as const satisfies readonly [TokenRule, ...TokenRule[]]

/**
 * GPT Image 2.5 output tokens by quality and aspect. Only low square for
 * gpt-image-2 is measured, so every row here is an OpenAI table estimate.
 * Source: OpenAI image generation pricing/token table
 * https://platform.openai.com/docs/guides/image-generation (read 2026-10-29).
 */
export const GPT_IMAGE_25_OUTPUT_TOKEN_RULES = [
  { when: { quality: 'low', aspect: 'square' }, tokens: 272 },
  { when: { quality: 'medium', aspect: 'square' }, tokens: 1056 },
  { when: { quality: 'high', aspect: 'square' }, tokens: 4160 },
  { when: { quality: 'xhigh', aspect: 'square' }, tokens: 6240 },
  { when: { quality: 'max', aspect: 'square' }, tokens: 8320 },
  { when: { quality: 'auto', aspect: 'square' }, tokens: 1056 },
  { when: { quality: 'low', aspect: 'wide' }, tokens: 408 },
  { when: { quality: 'low', aspect: 'tall' }, tokens: 408 },
  { when: { quality: 'medium', aspect: 'wide' }, tokens: 1584 },
  { when: { quality: 'medium', aspect: 'tall' }, tokens: 1584 },
  { when: { quality: 'high', aspect: 'wide' }, tokens: 6240 },
  { when: { quality: 'high', aspect: 'tall' }, tokens: 6240 },
  { when: { quality: 'xhigh', aspect: 'wide' }, tokens: 9360 },
  { when: { quality: 'xhigh', aspect: 'tall' }, tokens: 9360 },
  { when: { quality: 'max', aspect: 'wide' }, tokens: 12480 },
  { when: { quality: 'max', aspect: 'tall' }, tokens: 12480 },
  { when: { quality: 'auto', aspect: 'wide' }, tokens: 1584 },
  { when: { quality: 'auto', aspect: 'tall' }, tokens: 1584 },
  { when: {}, tokens: 1056 },
] as const satisfies readonly [TokenRule, ...TokenRule[]]

/** Shared GPT Image settings. A model file adds identity, quality and background. */
export const OPENAI_FAMILY = {
  family: 'openai',
  icon: 'sparkles',
  aspectRatios: OPENAI_RATIOS,
  defaultAspectRatio: 'auto',
  autoAspectRatio: '1:1',
  resolutions: null,
  defaultResolution: null,
  defaultQuality: 'auto',
  defaultBackground: 'auto',
  maxN: 10,
  referenceMax: 16,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  seed: false,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  // "image 1" style. Source: https://platform.openai.com/docs/guides/image-generation (read 2026-11-02).
  refLabel: 'image {n}',
  // Live supported_parameters read 2026-10-29.
  params: ['n', 'aspect_ratio', 'quality', 'background', 'input_references'],
  errors: OPENAI_ERRORS,
} as const satisfies Partial<ImagePreset>
