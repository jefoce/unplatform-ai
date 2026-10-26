import { Ratio } from 'lucide-react'

import type { AspectChoice } from '@/core/presets/types'

interface RatioIconProps {
  ratio: AspectChoice
  size?: number
}

/** Outlined box drawn at the aspect ratio, `auto` uses the lucide icon. */
export function RatioIcon(props: RatioIconProps) {
  const { ratio, size = 14 } = props

  if (ratio === 'auto') {
    return <Ratio size={size} aria-hidden />
  }

  const [width = 1, height = 1] = ratio.split(':').map(Number)
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
