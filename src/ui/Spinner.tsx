import { cn } from '@/lib/cn'

const TONE_CLASSES = {
  accent: 'border-t-accent',
  muted: 'border-t-white/50',
  onAccent: 'border-on-accent/20 border-t-on-accent',
} as const

interface SpinnerProps {
  size?: number
  className?: string
  tone?: keyof typeof TONE_CLASSES
}

/** Small rotating loading indicator. */
export function Spinner(props: SpinnerProps) {
  const { size = 18, className, tone = 'accent' } = props

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-white/15',
        TONE_CLASSES[tone],
        className,
      )}
    />
  )
}
