import 'server-only'

import { FLATTEN_BACKGROUND, FLATTEN_LIGHT, FLATTEN_LUMINANCE } from '@/core/constants'
import type { FlattenColor } from '@/core/media-types'

import sharp from './sharp'

/** Average of opaque pixels that touch transparency, at 256 px preview. */
export async function flattenColor(source: string): Promise<FlattenColor> {
  const { data, info } = await sharp(source, { pages: 1 })
    .rotate()
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const channels = info.channels
  let red = 0
  let green = 0
  let blue = 0
  let count = 0

  const byteAt = (index: number): number => {
    return data.at(index) ?? 0
  }

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return 0
    }

    return byteAt((y * width + x) * channels + 3)
  }

  const touchesTransparency = (x: number, y: number): boolean => {
    return (
      alphaAt(x - 1, y) < 255 ||
      alphaAt(x + 1, y) < 255 ||
      alphaAt(x, y - 1) < 255 ||
      alphaAt(x, y + 1) < 255
    )
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels

      if (byteAt(index + 3) !== 255) {
        continue
      }

      if (!touchesTransparency(x, y)) {
        continue
      }

      red += byteAt(index)
      green += byteAt(index + 1)
      blue += byteAt(index + 2)
      count += 1
    }
  }

  if (count === 0) {
    return FLATTEN_BACKGROUND
  }

  const luminance =
    (0.2126 * (red / count) + 0.7152 * (green / count) + 0.0722 * (blue / count)) / 255

  if (luminance > FLATTEN_LUMINANCE) {
    return FLATTEN_LIGHT
  }

  return FLATTEN_BACKGROUND
}
