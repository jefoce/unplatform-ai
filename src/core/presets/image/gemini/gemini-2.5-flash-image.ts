import { PROVIDER_IDS } from '../../../providers/types'
import {
  GEMINI_RATIOS_STANDARD,
  IMAGE_PROMPT_MAX_CHARS,
  IMAGE_REFERENCE_LIMITS,
  tokenPricing,
} from '../../common/options'
import type { ImagePreset } from '../types'
import { GEMINI_FAMILY } from './family'

export const GEMINI_25_FLASH_IMAGE: ImagePreset = {
  ...GEMINI_FAMILY,
  id: 'gemini-2.5-flash-image',
  title: 'Nano Banana',
  description: 'Gemini image model without a resolution control, up to 3 references.',
  aspectRatios: GEMINI_RATIOS_STANDARD,
  resolutions: null,
  defaultResolution: null,
  maxN: 1,
  referenceMax: 3,
  referenceLimits: IMAGE_REFERENCE_LIMITS,
  promptMaxChars: IMAGE_PROMPT_MAX_CHARS,
  bindings: [
    {
      provider: PROVIDER_IDS[0],
      modelId: 'google/gemini-2.5-flash-image',
      // $0.0000003 per input token and $0.00003 per output token, live endpoints read
      // 2026-10-29. No resolution control, so one fallback rule. 1120 output and
      // 258 reference tokens are estimates, see report.
      pricing: tokenPricing({
        outputUsd: 0.00003,
        inputImageUsd: 0.0000003,
        outputTokens: 1120,
        referenceTokens: 258,
      }),
    },
  ],
}
