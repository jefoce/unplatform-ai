import 'server-only'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { inputIds } from '@/core/submit-state'

interface ActiveUploadParams {
  id: string
  generations: GenerationRecord[]
  images: ImageRecord[]
}

/** True while a video or image job still reads this upload. */
export function isUploadBusy(params: ActiveUploadParams): boolean {
  const { id, generations, images } = params

  return (
    generations.some((entry) => {
      return inputIds(entry.input).includes(id)
    }) ||
    images.some((entry) => {
      return isImageActive(entry) && entry.input.references.includes(id)
    })
  )
}
