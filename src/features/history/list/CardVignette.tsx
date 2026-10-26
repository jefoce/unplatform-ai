import { cn } from '@/lib/cn'

type VignetteScope = 'card' | 'media'

const BASE_CLASSES =
  'pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 ease-out'

// A list row is wider and taller than a tile, so equal stops read as a hard ring.
// The media gradient starts later, adds a mid stop and ends lighter.
const GRADIENT_CLASSES = {
  card: 'bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]',
  media:
    'bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.18)_80%,rgba(0,0,0,0.42)_100%)]',
} satisfies Record<VignetteScope, string>

const SCOPE_CLASSES = {
  card: 'group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100',
  media: 'group-hover/media:opacity-100 group-has-focus-visible/media:opacity-100',
} satisfies Record<VignetteScope, string>

interface CardVignetteProps {
  scope: VignetteScope
}

/** Hover vignette. `card` follows the tile, `media` follows only the video box. */
export function CardVignette(props: CardVignetteProps) {
  const { scope } = props

  return (
    <div aria-hidden className={cn(BASE_CLASSES, GRADIENT_CLASSES[scope], SCOPE_CLASSES[scope])} />
  )
}
