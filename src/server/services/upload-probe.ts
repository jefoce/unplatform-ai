import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_IMAGE_PIXELS } from '@/core/constants'
import { kindFromExt } from '@/core/media/media-kinds'
import type { MediaKind } from '@/core/media/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

import { UploadError } from '../errors'
import { probeMedia } from '../media/ffmpeg'
import sharp, { SHARP_INPUT_OPTIONS, sharpQueue } from '../media/sharp'

export function assertSupported(ext: string): MediaKind {
  if (ext === '.heic' || ext === '.heif') {
    throw new UploadError(400, 'HEIC images are not supported')
  }

  const kind = kindFromExt(ext)

  if (isNil(kind)) {
    throw new UploadError(400, `Unsupported file type: ${ext}`)
  }

  return kind
}

export async function probe(
  media: string,
  kind: MediaKind,
): Promise<Pick<UploadItem, 'width' | 'height' | 'durationSec'>> {
  if (kind === 'image') {
    const meta = await sharpQueue
      .run(() => {
        return sharp(media, SHARP_INPUT_OPTIONS).metadata()
      })
      .catch(() => {
        return null
      })

    if (isNil(meta)) {
      return {}
    }

    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_IMAGE_PIXELS) {
      throw new UploadError(400, `Image is too large (max ${MAX_IMAGE_PIXELS} pixels)`)
    }

    return { width: meta.width, height: meta.height }
  }

  try {
    const info = await probeMedia(media)

    return {
      width: info.width ?? undefined,
      height: info.height ?? undefined,
      durationSec: info.durationSec ?? undefined,
    }
  } catch {
    return {}
  }
}
