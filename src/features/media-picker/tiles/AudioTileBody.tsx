'use client'

import { isNil } from 'lodash-es'
import { Pause, Play } from 'lucide-react'
import type { MouseEvent } from 'react'

import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { cn } from '@/lib/cn'
import { waveBars } from '@/lib/wave-bars'

const AUDIO_BARS = 36

interface AudioTileBodyProps {
  name: string
  src: string
  durationSec?: number
  isMissing?: boolean
  isBadgeOffset?: boolean
}

/** Audio name, wave and play control shared by upload and folder tiles. */
export function AudioTileBody(props: AudioTileBodyProps) {
  const { name, src, durationSec, isMissing, isBadgeOffset } = props
  const audioBars = waveBars(name, AUDIO_BARS)
  const isAudioPlaying = useAudioPlaying(src)
  const elapsed = useAudioTime(src)
  let total = durationSec ?? 0

  if (isNil(durationSec) && currentSrc() === src) {
    total = currentDuration()
  }

  const isPlayedRatio = !isNil(elapsed) && total > 0

  const playedRatio = isPlayedRatio ? elapsed / total : 0
  const played = Math.min(1, playedRatio)

  const badgeOffset = isBadgeOffset === true ? 'pt-6' : ''

  const handleAudioClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (isAudioPlaying) {
      pauseAudio()
    } else {
      playAudio(src)
    }
  }

  const PlayIcon = isAudioPlaying ? Pause : Play
  const playLabel = isAudioPlaying ? 'Pause' : 'Play'

  return (
    <>
      <span
        className={cn(
          'pointer-events-none absolute top-2 right-8 left-2 z-20 truncate text-xs font-semibold',
          badgeOffset,
        )}
      >
        {name}
      </span>
      <span className="pointer-events-none absolute inset-x-2 top-1/2 flex h-10 max-h-10 -translate-y-1/2 items-center gap-px">
        {audioBars.map((height, index) => {
          return (
            <span
              /* eslint-disable-next-line react/no-array-index-key -- static list */
              key={index}
              style={{ height: `${height}%` }}
              className={cn(
                'min-w-px flex-1 rounded-full',
                index / audioBars.length < played && 'bg-accent',
                !(index / audioBars.length < played) && 'bg-fg-2/50',
              )}
            />
          )
        })}
      </span>
      <button
        type="button"
        onClick={handleAudioClick}
        aria-label={`${playLabel} ${name}`}
        disabled={isMissing}
        className="absolute right-2 bottom-2 z-20 flex size-7 items-center justify-center rounded-full border border-white/10 bg-black/50 text-fg backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-40 linux:bg-solid-overlay"
      >
        <PlayIcon size={14} className="fill-current" aria-hidden />
      </button>
    </>
  )
}
