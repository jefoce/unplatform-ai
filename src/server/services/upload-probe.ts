import 'server-only'

import { isNil } from 'lodash-es'

import { kindFromExt } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

import { UploadError } from '../errors'
import { probeMedia } from '../media/ffmpeg'
import sharp from '../media/sharp'

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
    try {
      const meta = await sharp(media).metadata()

      return { width: meta.width, height: meta.height }
    } catch {
      return {}
    }
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
