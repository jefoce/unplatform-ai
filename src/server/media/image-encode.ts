import 'server-only'

import { isNil } from 'lodash-es'

import { IMAGE_MAX_SIDE_PX } from '@/core/constants'
import type { FlattenColor } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

import { uploadPaths } from '../paths'
import { createLimiter } from '../sync/limiter'
import { flattenColor } from './flatten-color'
import {
  type CacheRecord,
  type EncodedImage,
  readCache,
  readOpaque,
  toEncoded,
  writeCache,
  writeOpaque,
} from './image-cache'
import sharp from './sharp'

export interface EncodeStepParams {
  upload: UploadItem
  step: number
  maxSide: number
  jpegQuality: number
  alpha: boolean
}

export const sideFor = (stepSide: number, modelSide?: number): number => {
  return Math.min(stepSide, modelSide ?? IMAGE_MAX_SIDE_PX)
}

const MAX_CONCURRENT = 2
const limiter = createLimiter('imageEncodeQueue', MAX_CONCURRENT)
const inFlight = new Map<string, Promise<EncodedImage>>()
const opacityInFlight = new Map<string, Promise<boolean>>()

/** Cached per upload and step. Source EXIF is never copied to the output. */
export async function encodeAtStep(params: EncodeStepParams): Promise<EncodedImage> {
  const { upload, step } = params
  const cached = await readCache(upload.id, step)

  if (cached) {
    return cached
  }

  const key = `${upload.id}:${step}`
  const shared = inFlight.get(key)

  if (shared) {
    return shared
  }

  const task = limiter
    .run(() => {
      return encodeUncached(params)
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, task)

  return task
}

async function encodeUncached(params: EncodeStepParams): Promise<EncodedImage> {
  const { upload, step, maxSide, jpegQuality, alpha: hasAlpha } = params
  // A parallel caller may have finished between the in-flight check and this task.
  const fresh = await readCache(upload.id, step)

  if (fresh) {
    return fresh
  }

  const source = uploadPaths(upload.id, upload.ext).media
  const isOpaque = await opacityFor(upload, source)
  const isTransparent = !isOpaque
  const shouldKeepAlpha = isTransparent && hasAlpha
  let flattened: FlattenColor | undefined

  if (isTransparent && !hasAlpha) {
    flattened = await flattenColor(source)
  }

  let pipeline = sharp(source, { pages: 1 })
    .rotate()
    .toColorspace('srgb')
    .withIccProfile('srgb')
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })

  if (shouldKeepAlpha) {
    pipeline = pipeline.png({ compressionLevel: 9, palette: false })
  } else {
    if (!isNil(flattened)) {
      pipeline = pipeline.flatten({ background: flattened })
    }

    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true, chromaSubsampling: '4:4:4' })
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  const format = shouldKeepAlpha ? 'png' : 'jpeg'

  const record: CacheRecord = {
    width: info.width,
    height: info.height,
    bytes: base64Bytes(data.length),
    format,
    flattened,
  }

  await writeCache({ id: upload.id, step, record, data })

  return toEncoded(record, data)
}

/** One stats() per upload, shared by every step and by plan/submit. */
async function opacityFor(upload: UploadItem, source: string): Promise<boolean> {
  const isOpaque = await readOpaque(upload.id)

  if (!isNil(isOpaque)) {
    return isOpaque
  }

  const shared = opacityInFlight.get(upload.id)

  if (shared) {
    return shared
  }

  const task = statsOpaque(source)
    .then(async (isOpaque) => {
      await writeOpaque(upload.id, isOpaque)

      return isOpaque
    })
    .finally(() => {
      opacityInFlight.delete(upload.id)
    })

  opacityInFlight.set(upload.id, task)

  return task
}

/** No alpha channel means opaque, so only alpha images pay for a full decode. */
async function statsOpaque(source: string): Promise<boolean> {
  const meta = await sharp(source).metadata()

  if (!meta.hasAlpha) {
    return true
  }

  return (await sharp(source, { pages: 1 }).stats()).isOpaque
}

const base64Bytes = (bytes: number): number => {
  return Math.ceil(bytes / 3) * 4
}
