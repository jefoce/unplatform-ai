import {
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  imageResolutionOptions,
  tokenPricing,
} from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_FAMILY, GEMINI_NANO_BANANA_OUTPUT_TOKEN_RULES } from './family'

export const GEMINI_NANO_BANANA_21: ImagePreset = {
  ...GEMINI_FAMILY,
  id: 'gemini-nano-banana-2.1',
  title: 'Nano Banana 2.1',
  description: 'Gemini image model with 1K to 4K output and up to 14 references.',
  resolutions: imageResolutionOptions(['1K', '2K', '4K']),
  defaultResolution: '1K',
  params: [...GEMINI_FAMILY.params, 'resolution'],
  maxN: 1,
  referenceMax: 14,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  bindings: [
    {
      provider: 'openrouter',
      modelId: 'google/gemini-nano-banana-2.1',
      // $0.00003 per output token, live endpoints read 2026-10-29.
      // Per-resolution output tokens come from the Google pricing page and
      // real-key probes, see GEMINI_NANO_BANANA_OUTPUT_TOKEN_RULES.
      pricing: tokenPricing({
        outputUsd: 0.00003,
        outputTokenRules: GEMINI_NANO_BANANA_OUTPUT_TOKEN_RULES,
        referenceTokens: 258,
      }),
    },
  ],
}
