import { isNil } from 'lodash-es'

/** Width and height in pixels. */
export interface PixelSize {
  width: number
  height: number
}

/** Both sides of an aspect string as positive finite numbers, null when malformed. */
export function parseAspect(aspect: string): [number, number] | null {
  const [width, height] = aspect.split(':').map(Number)

  if (isNil(width) || isNil(height) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  if (width <= 0 || height <= 0) {
    return null
  }

  return [width, height]
}

/** Pixel size for an aspect ratio, square for `auto` and malformed values. */
export function aspectSize(aspect: string): PixelSize {
  if (aspect === 'auto') {
    return { width: 1, height: 1 }
  }

  const sides = parseAspect(aspect)

  if (isNil(sides)) {
    return { width: 1, height: 1 }
  }

  return { width: sides[0], height: sides[1] }
}
