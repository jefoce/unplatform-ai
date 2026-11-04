import type { ImageSubmitBody } from '@/core/api/image'
import type { ImageGenerationInput } from '@/core/schemas/image-record'

/** Picks only the input fields, never the store's uploads or action functions. */
export function imageInputFromState(state: ImageGenerationInput): ImageSubmitBody {
  return {
    presetId: state.presetId,
    prompt: state.prompt,
    count: state.count,
    aspectRatio: state.aspectRatio,
    resolution: state.resolution,
    quality: state.quality,
    background: state.background,
    references: [...state.references],
    seed: state.seed,
  }
}
