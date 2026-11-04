import 'server-only'

import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import type { ImageOutputMediaType, ImageSavedOutput } from '@/core/schemas/image-record'

import { commitFile } from '../fs/atomic-file'
import sharp, { SHARP_INPUT_OPTIONS, sharpQueue } from '../media/sharp'
import { imageOutputPath, IMAGES_DIR, imageTempPath } from '../paths'

const EXT_BY_MEDIA_TYPE: Record<ImageOutputMediaType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

export function extensionForMediaType(mediaType: ImageOutputMediaType): string {
  return EXT_BY_MEDIA_TYPE[mediaType]
}

interface WriteImageOutputParams {
  recordId: string
  outputId: string
  index: number
  bytes: Uint8Array
  mediaType: ImageOutputMediaType
}

/** Writes bytes to a temp name, reads the size, then renames the final file. */
export async function writeImageOutput(params: WriteImageOutputParams): Promise<ImageSavedOutput> {
  const { recordId, outputId, index, bytes, mediaType } = params
  const ext = extensionForMediaType(mediaType)
  const file = `${recordId}-${index}${ext}`
  const temp = imageTempPath({ id: recordId, index, ext })
  const target = imageOutputPath({ id: recordId, index, ext })

  await fs.mkdir(IMAGES_DIR, { recursive: true })
  await fs.writeFile(temp, bytes)

  try {
    const meta = await sharpQueue.run(() => {
      return sharp(temp, SHARP_INPUT_OPTIONS).metadata()
    })

    const width = meta.width
    const height = meta.height

    if (isNil(width) || isNil(height)) {
      throw new Error('Image has no dimensions')
    }

    await commitFile({ temp, target })

    return {
      id: outputId,
      index,
      status: 'saved',
      file,
      mediaType,
      width,
      height,
      bytes: bytes.length,
      favorite: false,
      seed: null, // Filled by the job with the per-image seed.
    }
  } finally {
    await fs.unlink(temp).catch(() => {})
  }
}
