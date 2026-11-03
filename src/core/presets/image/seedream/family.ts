import { IMAGE_PROMPT_MAX_CHARS, IMAGE_REFERENCE_LIMITS } from '../../common/options'
import type { ImageAspectChoice, ImagePreset } from '../types'
import { SEEDREAM_ERRORS } from './errors'

/** Seedream accepts these ratios on every model in the family. */
const SEEDREAM_RATIOS: readonly ImageAspectChoice[] = [
  '1:1',
  '1:2',
  '2:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '9:19.5',
  '19.5:9',
  '9:20',
  '20:9',
  '9:21',
  '21:9',
  'auto',
]

/** Shared Seedream settings. A model file adds identity, limits and pricing. */
export const SEEDREAM_FAMILY = {
  family: 'seedream',
  icon: 'sparkles',
  aspectRatios: SEEDREAM_RATIOS,
  defaultAspectRatio: '1:1',
  qualities: null,
  defaultQuality: null,
  backgrounds: null,
  defaultBackground: null,
  seed: true,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  // "image 1" style. Source: https://docs.byteplus.com/en/docs/ModelArk/1541523 (read 2026-11-02).
  refLabel: 'image {n}',
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  // Live supported_parameters read 2026-10-29.
  params: ['n', 'aspect_ratio', 'resolution', 'input_references', 'seed'],
  errors: SEEDREAM_ERRORS,
} as const satisfies Partial<ImagePreset>
