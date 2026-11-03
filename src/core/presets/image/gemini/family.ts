import type { TokenRule } from '../../../pricing/types'
import { GEMINI_RATIOS_WIDE } from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_ERRORS } from './errors'

/**
 * Gemini 3 Pro Image output tokens per image. 1K and 2K both consume 1120,
 * 4K consumes 2000. Never scale by pixel area.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (read 2026-10-30).
 */
export const GEMINI_3_PRO_OUTPUT_TOKEN_RULES = [
  { when: { resolution: '2K' }, tokens: 1120 },
  { when: { resolution: '4K' }, tokens: 2000 },
  { when: {}, tokens: 1120 },
] as const satisfies readonly [TokenRule, ...TokenRule[]]

/**
 * Gemini 3.1 Flash Image output tokens per image: 512 consumes 747, 1K 1120,
 * 2K 1680, 4K 2520. 2K matched a 2026-10-30 real-key probe.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (read 2026-10-30).
 */
export const GEMINI_3_1_FLASH_OUTPUT_TOKEN_RULES = [
  { when: { resolution: '512' }, tokens: 747 },
  { when: { resolution: '2K' }, tokens: 1680 },
  { when: { resolution: '4K' }, tokens: 2520 },
  { when: {}, tokens: 1120 },
] as const satisfies readonly [TokenRule, ...TokenRule[]]

/**
 * Nano Banana 2.1 output tokens per image: 1K 1120, 2K 1680, 4K 3780.
 * Real-key probes on 2026-10-30 returned image_tokens 1680 at 2K and 3780 at
 * 4K, matching the pricing page. Completion tokens include text and run higher.
 * Source: https://ai.google.dev/gemini-api/docs/pricing (read 2026-10-30).
 */
export const GEMINI_NANO_BANANA_OUTPUT_TOKEN_RULES = [
  { when: { resolution: '2K' }, tokens: 1680 },
  { when: { resolution: '4K' }, tokens: 3780 },
  { when: {}, tokens: 1120 },
] as const satisfies readonly [TokenRule, ...TokenRule[]]

/** Shared Gemini settings. A model file adds identity, limits and pricing. */
export const GEMINI_FAMILY = {
  family: 'gemini',
  icon: 'sparkles',
  aspectRatios: GEMINI_RATIOS_WIDE,
  defaultAspectRatio: '1:1',
  qualities: null,
  defaultQuality: null,
  backgrounds: null,
  defaultBackground: null,
  seed: false,
  // "image 1" style. Source: https://ai.google.dev/gemini-api/docs/image-generation (read 2026-11-02).
  refLabel: 'image {n}',
  // Live supported_parameters read 2026-10-29.
  params: ['n', 'aspect_ratio', 'input_references'],
  errors: GEMINI_ERRORS,
} as const satisfies Partial<ImagePreset>
