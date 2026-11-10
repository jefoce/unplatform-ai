import {
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  imageResolutionOptions,
  tokenPricing,
} from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_FAMILY } from './family'

export const GEMINI_31_FLASH_LITE: ImagePreset = {
  ...GEMINI_FAMILY,
  id: 'gemini-3.1-flash-lite-image',
  title: 'Nano Banana 2 Lite',
  description: 'Fast Gemini image model at 1K with up to 14 references.',
  resolutions: imageResolutionOptions(['1K']),
  defaultResolution: '1K',
  params: [...GEMINI_FAMILY.params, 'resolution'],
  maxN: 1,
  referenceMax: 14,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'google/gemini-3.1-flash-lite-image',
      // $0.00003 per output token, live endpoints read 2026-10-29.
      // 1120 output at 1K is measured. One rule, an estimate, because the
      // pricing page gives no per-resolution counts for this model.
      pricing: tokenPricing({
        outputUsd: 0.00003,
        outputTokens: 1120,
        referenceTokens: 258,
      }),
    },
  ],
}
