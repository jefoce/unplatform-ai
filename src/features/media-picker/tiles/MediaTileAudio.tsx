'use client'

import { isNil } from 'lodash-es'
import { Pause, Play } from 'lucide-react'
import type { MouseEvent } from 'react'

import type { UploadItem } from '@/core/schemas/upload-item'
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

interface MediaTileAudioProps {
  item: UploadItem
  audioSrc: string
  isMissing: boolean
}

/** Audio title, wave and play control for a media tile. */
export function MediaTileAudio(props: MediaTileAudioProps) {
  const { item, audioSrc, isMissing } = props
  const audioBars = waveBars(item.originalName, AUDIO_BARS)
  const isAudioPlaying = useAudioPlaying(audioSrc)
  const elapsed = useAudioTime(audioSrc)
  let total = item.durationSec ?? 0

  if (isNil(item.durationSec) && currentSrc() === audioSrc) {
    total = currentDuration()
  }

  const isPlayedRatio = !isNil(elapsed) && total > 0

  const playedRatio = isPlayedRatio ? elapsed / total : 0
  const played = Math.min(1, playedRatio)
  const isBadgeOffset = item.source === 'link' || isMissing

  const badgeOffset = isBadgeOffset ? 'pt-6' : ''

  const handleAudioClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (isAudioPlaying) {
      pauseAudio()
    } else {
      playAudio(audioSrc)
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
        {item.originalName}
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
                index / audioBars.length < played && 'bg-lime',
                !(index / audioBars.length < played) && 'bg-fg-2/50',
              )}
            />
          )
        })}
      </span>
      <button
        type="button"
        onClick={handleAudioClick}
        aria-label={`${playLabel} ${item.originalName}`}
        disabled={isMissing}
        className="absolute right-2 bottom-2 z-20 flex size-7 items-center justify-center rounded-full border border-white/10 bg-black/50 text-fg backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-40"
      >
        <PlayIcon size={14} className="fill-current" aria-hidden />
      </button>
    </>
  )
}
