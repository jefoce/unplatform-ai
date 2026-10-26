'use client'

import { type KeyboardEvent, type MouseEvent } from 'react'

import { seekAudio } from '@/lib/audio-player'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

interface PreviewAudioWaveProps {
  bars: number[]
  played: number
  at: number
  total: number
  onToggle: () => void
}

/** Waveform bars that seek on click and keyboard, with play state coloring. */
export function PreviewAudioWave(props: PreviewAudioWaveProps) {
  const { bars, played, at, total } = props

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    if (total === 0) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()

    seekAudio(((event.clientX - rect.left) / rect.width) * total)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()

      const delta = event.key === 'ArrowLeft' ? -5 : 5

      seekAudio(at + delta)

      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      props.onToggle()
    }
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek audio"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.round(at * 10) / 10}
      aria-valuetext={`${formatClock(at)} / ${formatClock(total)}`}
      onClick={handleSeek}
      onKeyDown={handleKeyDown}
      className="flex h-20 w-full cursor-pointer items-center gap-px rounded-sm"
    >
      {bars.map((height, index) => {
        return (
          <span
            /* eslint-disable-next-line react/no-array-index-key -- static list */
            key={index}
            style={{ height: `${height}%` }}
            className={cn(
              'min-w-px flex-1 rounded-full',
              index / bars.length < played && 'bg-lime',
              !(index / bars.length < played) && 'bg-fg-2/50',
            )}
          />
        )
      })}
    </div>
  )
}
