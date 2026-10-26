'use client'

interface ProgressRingProps {
  value: number
}

/** Circular upload progress indicator. */
export function ProgressRing(props: ProgressRingProps) {
  const { value } = props
  const percent = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <span className="relative flex size-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-white/10" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
          className="stroke-lime transition-[stroke-dasharray]"
        />
      </svg>
      <span className="text-xxs font-medium text-fg tabular-nums">{percent}%</span>
    </span>
  )
}
