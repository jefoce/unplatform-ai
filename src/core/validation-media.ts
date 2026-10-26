import { isEmpty, isNil } from 'lodash-es'

import { KIND_TITLE } from './media-kinds'
import type { ModelPreset, ReferenceLimits } from './presets/types'
import type { UploadItem } from './schemas/upload-item'
import { joinWords } from './text'

const MB = 1024 * 1024

/** Whole seconds stay plain, fractions keep up to two decimals. */
export const seconds = (value: number): string => {
  return String(Number(value.toFixed(2)))
}

const formatRatio = (ratio: number): string => {
  return String(Number(ratio.toFixed(1)))
}

interface CheckReferenceLimitsParams {
  upload: UploadItem
  preset: ModelPreset
  errors: string[]
}

interface ReferenceLimitContext extends CheckReferenceLimitsParams {
  limits: ReferenceLimits
  title: string
  name: string
}

const checkFormat = (ctx: ReferenceLimitContext): void => {
  const { upload, limits, preset, errors } = ctx
  const formats = limits.formats

  if (isNil(formats)) {
    return
  }

  if (isEmpty(formats)) {
    return
  }

  const ext = upload.ext.replace(/^\./, '').toLowerCase()

  if (formats.includes(ext)) {
    return
  }

  errors.push(
    `${preset.title} takes ${upload.kind} references as ${joinWords(formats, 'or')} (${upload.originalName})`,
  )
}

const checkMinSide = (ctx: ReferenceLimitContext, short: number): void => {
  const min = ctx.limits.minSidePx

  if (isNil(min) || short >= min) {
    return
  }

  ctx.errors.push(`${ctx.title} too small: ${short} px, min ${min} px (${ctx.name})`)
}

const checkMaxSide = (ctx: ReferenceLimitContext, long: number): void => {
  const max = ctx.limits.maxSidePx

  if (isNil(max) || long <= max) {
    return
  }

  ctx.errors.push(`${ctx.title} too large: ${long} px, max ${max} px (${ctx.name})`)
}

const checkAspect = (ctx: ReferenceLimitContext): void => {
  const { upload, limits, title, name, errors } = ctx
  const max = limits.maxAspect

  if (isNil(max) || isNil(upload.width) || isNil(upload.height)) {
    return
  }

  const short = Math.min(upload.width, upload.height)
  const long = Math.max(upload.width, upload.height)

  if (short === 0 || long / short <= max) {
    return
  }

  errors.push(`${title} too narrow: ${formatRatio(long / short)}:1, max ${max}:1 (${name})`)
}

const checkDimensions = (ctx: ReferenceLimitContext): void => {
  const { upload } = ctx

  if (isNil(upload.width) || isNil(upload.height)) {
    return
  }

  checkMinSide(ctx, Math.min(upload.width, upload.height))
  checkMaxSide(ctx, Math.max(upload.width, upload.height))
  checkAspect(ctx)
}

const checkBytes = (ctx: ReferenceLimitContext): void => {
  const { upload, limits, title, name, errors } = ctx
  const max = limits.maxBytes

  if (isNil(max) || upload.sizeBytes <= max) {
    return
  }

  errors.push(
    `${title} file too large: ${Math.round(upload.sizeBytes / MB)} MB, max ${Math.round(max / MB)} MB (${name})`,
  )
}

/** Per-kind size, aspect and format checks that only need upload metadata. */
export function checkReferenceLimits(params: CheckReferenceLimitsParams): void {
  const { upload, preset, errors } = params
  const limits = preset.referenceLimits?.[upload.kind]

  if (!limits) {
    return
  }

  const ctx = {
    upload,
    preset,
    errors,
    limits,
    title: KIND_TITLE[upload.kind],
    name: upload.originalName,
  }

  checkFormat(ctx)
  checkDimensions(ctx)
  checkBytes(ctx)
}
