import { isNil } from 'lodash-es'

import type { GenerationRecord } from '../schemas/generation-record'
import { parseAspect } from './geometry'

const hasPx = (value: number | undefined): boolean => {
  return !isNil(value) && value !== 0 && !Number.isNaN(value)
}

const sizedAspect = (width: number | undefined, height: number | undefined): string | undefined => {
  if (!hasPx(width) || !hasPx(height)) {
    return undefined
  }

  return `${width}/${height}`
}

/** Video aspect truth: output size, then start frame size, then selected ratio. */
export function videoRecordAspect(record: GenerationRecord): string {
  const start = record.input.frames.start
  let frame

  if (!isNil(start)) {
    frame = record.inputsSnapshot[start]
  }

  const sized =
    sizedAspect(record.output?.width, record.output?.height) ??
    sizedAspect(frame?.width, frame?.height)

  if (!isNil(sized)) {
    return sized
  }

  const sides = parseAspect(record.input.aspectRatio)

  if (isNil(sides)) {
    return '16/9'
  }

  return `${sides[0]}/${sides[1]}`
}
