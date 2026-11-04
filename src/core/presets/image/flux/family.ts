import { IMAGE_PROMPT_MAX_CHARS, IMAGE_REFERENCE_LIMITS } from '../../common/options'
import type { ImageAspectChoice, ImagePreset } from '../types'
import { FLUX_ERRORS } from './errors'

/** FLUX 3 Klein ratios. */
const FLUX_RATIOS: readonly ImageAspectChoice[] = [
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
  'auto',
]

/** Shared FLUX settings. Only one model ships in 0.4.0. */
export const FLUX_FAMILY = {
  family: 'flux',
  icon: 'sparkles',
  aspectRatios: FLUX_RATIOS,
  defaultAspectRatio: '1:1',
  qualities: null,
  defaultQuality: null,
  backgrounds: null,
  defaultBackground: null,
  maxN: 1,
  referenceMax: 10,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  seed: false,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  // "image 1" style. Source: https://docs.bfl.ai/quick_start/generating_images (read 2026-11-02).
  refLabel: 'image {n}',
  // Live supported_parameters read 2026-10-29.
  params: ['n', 'aspect_ratio', 'resolution', 'input_references'],
  errors: FLUX_ERRORS,
} as const satisfies Partial<ImagePreset>
