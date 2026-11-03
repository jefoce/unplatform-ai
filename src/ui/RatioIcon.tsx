import { Ratio } from 'lucide-react'

import { parseAspect } from '@/core/media/geometry'
import type { ImageAspectChoice } from '@/core/presets/image/types'
import type { AspectChoice } from '@/core/presets/video/types'

interface RatioIconProps {
  ratio: AspectChoice | ImageAspectChoice
  size?: number
}

/** Outlined box drawn at the aspect ratio, `auto` uses the lucide icon. */
export function RatioIcon(props: RatioIconProps) {
  const { ratio, size = 14 } = props

  if (ratio === 'auto') {
    return <Ratio size={size} aria-hidden />
  }

  const sides = parseAspect(ratio) ?? [1, 1]
  const [width, height] = sides
  const scale = size / Math.max(width, height)

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="rounded-xs border border-current"
        style={{ width: width * scale, height: height * scale }}
      />
    </span>
  )
}
