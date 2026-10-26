import 'server-only'

import { sumBy } from 'lodash-es'

import { IMAGE_MAX_ENCODED_MB, IMAGE_STEPS } from '@/core/constants'
import type { ReferencePlan } from '@/core/media-types'
import type { ModelPreset, ReferenceLimits } from '@/core/presets/types'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'

import { HttpError } from '../errors'
import type { EncodedImage } from './image-cache'
import { encodeAtStep, sideFor } from './image-encode'

export interface EncodeImagesParams {
  uploads: UploadItem[]
  preset: ModelPreset
  budgetBytes: number
  baseBytes?: number
}

export interface EncodedImages {
  plan: ReferencePlan
  media: Dict<EncodedImage>
}

/** Plain failure when even the last ladder step does not fit. */
export class ImageTooLargeError extends HttpError {
  constructor() {
    super(400, 'References are too large to send. Remove some images or use smaller ones.')
  }
}

const MB = 1024 * 1024

/** Encodes every image at one shared ladder step, then checks the request budget. */
export async function encodeImages(params: EncodeImagesParams): Promise<EncodedImages> {
  const { uploads, preset, budgetBytes, baseBytes = 0 } = params

  const images = uploads.filter((upload) => {
    return upload.kind === 'image'
  })

  const limit = preset.referenceLimits?.image
  const perImageBytes = Math.min(limit?.maxBytes ?? Infinity, IMAGE_MAX_ENCODED_MB * MB)

  if (images.length === 0) {
    return emptyResult(limit)
  }

  for (const [index, step] of IMAGE_STEPS.entries()) {
    const result = await tryStep({
      images,
      step,
      stepNumber: index + 1,
      limit,
      perImageBytes,
      budgetBytes,
      baseBytes,
    })

    if (result) {
      return result
    }
  }

  throw new ImageTooLargeError()
}

function emptyResult(limit: ReferenceLimits | undefined): EncodedImages {
  return {
    plan: {
      step: 1,
      maxSide: sideFor(IMAGE_STEPS[0].maxSidePx, limit?.maxSidePx),
      totalBytes: 0,
      images: [],
    },
    media: {},
  }
}

interface TryStepParams {
  images: UploadItem[]
  step: (typeof IMAGE_STEPS)[number]
  stepNumber: number
  limit: ReferenceLimits | undefined
  perImageBytes: number
  budgetBytes: number
  baseBytes: number
}

async function tryStep(params: TryStepParams): Promise<EncodedImages | null> {
  const { images, step, stepNumber, limit, perImageBytes, budgetBytes, baseBytes } = params
  const maxSide = sideFor(step.maxSidePx, limit?.maxSidePx)

  const encoded = await Promise.all(
    images.map(async (upload) => {
      return {
        upload,
        image: await encodeAtStep({
          upload,
          step: stepNumber,
          maxSide,
          jpegQuality: step.jpegQuality,
          alpha: limit?.alpha ?? false,
        }),
      }
    }),
  )

  const totalBytes = sumBy(encoded, ({ image }) => {
    return image.bytes
  })

  const isWithinBudget = totalBytes + baseBytes <= budgetBytes

  const isUnderCap = encoded.every(({ image }) => {
    return image.bytes <= perImageBytes
  })

  if (!isWithinBudget || !isUnderCap) {
    return null
  }

  const media = Object.fromEntries(
    encoded.map(({ upload, image }) => {
      return [upload.id, image]
    }),
  )

  return {
    plan: {
      step: stepNumber,
      maxSide,
      totalBytes,
      images: encoded.map(({ upload, image }) => {
        return {
          id: upload.id,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          format: image.format,
          flattened: image.flattened,
        }
      }),
    },
    media,
  }
}
