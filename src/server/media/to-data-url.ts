import 'server-only'

import fs from 'node:fs/promises'

import { MAX_INLINE_MEDIA_MB } from '@/core/constants'
import type { UploadItem } from '@/core/schemas/upload-item'

import { HttpError } from '../errors'
import { uploadPaths } from '../paths'

class MediaTooLargeError extends HttpError {
  constructor(message: string) {
    super(400, message)
  }
}

/** Base64 output length for `bytes` of raw input. */
function estimateEncodedBytes(bytes: number): number {
  return Math.ceil(bytes / 3) * 4
}

const MAX_BYTES = MAX_INLINE_MEDIA_MB * 1024 * 1024

interface DataUrlResult {
  url: string
  bytes: number
}

/** Turns a non-image upload into a data URL. Images use image-data-url. */
export async function toDataUrl(upload: UploadItem): Promise<DataUrlResult> {
  const { media } = uploadPaths(upload.id, upload.ext)
  const bytes = await fs.readFile(media)

  if (bytes.length > MAX_BYTES) {
    const mb = Math.ceil(bytes.length / (1024 * 1024))

    throw new MediaTooLargeError(
      `Reference too large to send inline (${mb} MB, max ${MAX_INLINE_MEDIA_MB} MB)`,
    )
  }

  return {
    url: `data:${upload.mime};base64,${bytes.toString('base64')}`,
    bytes: estimateEncodedBytes(bytes.length),
  }
}
