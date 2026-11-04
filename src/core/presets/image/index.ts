import { FLUX_3_KLEIN } from './flux/flux-3-image-klein'
import { GEMINI_25_FLASH_IMAGE } from './gemini/gemini-2.5-flash-image'
import { GEMINI_31_FLASH_IMAGE } from './gemini/gemini-3.1-flash-image'
import { GEMINI_31_FLASH_LITE } from './gemini/gemini-3.1-flash-lite-image'
import { GEMINI_3_PRO_IMAGE } from './gemini/gemini-3-pro-image'
import { GEMINI_NANO_BANANA_21 } from './gemini/gemini-nano-banana-2.1'
import { GPT_IMAGE_2 } from './openai/gpt-image-2'
import { GPT_IMAGE_25_FLARE } from './openai/gpt-image-2.5-flare'
import { GPT_IMAGE_25_SUNBURST } from './openai/gpt-image-2.5-sunburst'
import { SEEDREAM_5_FLASH } from './seedream/seedream-5-0-flash'
import { SEEDREAM_5_LITE } from './seedream/seedream-5-0-lite'
import { SEEDREAM_5_PRO } from './seedream/seedream-5-0-pro'
import type { ImagePreset } from './types'

export const IMAGE_PRESETS = [
  GEMINI_NANO_BANANA_21,
  GEMINI_31_FLASH_LITE,
  GEMINI_31_FLASH_IMAGE,
  GEMINI_3_PRO_IMAGE,
  GEMINI_25_FLASH_IMAGE,
  SEEDREAM_5_FLASH,
  SEEDREAM_5_LITE,
  SEEDREAM_5_PRO,
  GPT_IMAGE_25_SUNBURST,
  GPT_IMAGE_25_FLARE,
  GPT_IMAGE_2,
  FLUX_3_KLEIN,
] as const satisfies readonly ImagePreset[]

export const DEFAULT_IMAGE_PRESET_ID = GEMINI_31_FLASH_IMAGE.id

export const findImagePreset = (id: string): ImagePreset | null => {
  return (
    IMAGE_PRESETS.find((preset) => {
      return preset.id === id
    }) ?? null
  )
}
