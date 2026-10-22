'use client'

import { type MouseEvent, useCallback } from 'react'
import { isNil } from 'lodash-es'
import { Pause, Play } from 'lucide-react'

import type { UploadItem } from '@/core/types'
import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { cn } from '@/lib/cn'
import { formatMediaDuration } from '@/lib/format'
import { waveBars } from '@/lib/wave-bars'

const AUDIO_BARS = 40

interface AudioReferenceProps {
  upload: UploadItem
  src: string
  name: string
}

/** Two-column audio tile with waveform progress and a play button. */
export function AudioReference(props: AudioReferenceProps) {
  const { upload, src, name } = props
  const isPlaying = useAudioPlaying(src)
  const elapsed = useAudioTime(src)
  const total = upload.durationSec ?? (currentSrc() === src ? currentDuration() : 0)
  const played = !isNil(elapsed) && total > 0 ? elapsed / total : 0
  const bars = waveBars(upload.originalName, AUDIO_BARS)
  const handleTogglePlay = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.stopPropagation()

      if (isPlaying) pauseAudio()
      else playAudio(src)
    },
    [isPlaying, src],
  )

  return (
    <div className="flex size-full flex-col justify-between overflow-hidden rounded-xl bg-white/10 px-1.5 py-1">
      <span className="flex h-4 w-full items-end gap-px">
        {bars.map((height, index) => (
          <span
            /* eslint-disable-next-line react/no-array-index-key -- static list */
            key={index}
            style={{ height: `${height}%` }}
            className={cn(
              'flex-1 rounded-full',
              index / bars.length < played ? 'bg-lime' : 'bg-fg-2/60',
            )}
          />
        ))}
      </span>
      <span className="flex h-4 items-center justify-between">
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${name}`}
          className="flex size-4 items-center justify-center rounded-full bg-black/40 text-fg hover:bg-black/60"
        >
          {isPlaying ? (
            <Pause size={10} className="fill-current" aria-hidden />
          ) : (
            <Play size={10} className="fill-current" aria-hidden />
          )}
        </button>
        <span className="text-xxs leading-none text-white/50 tabular-nums">
          {formatMediaDuration(elapsed ?? total, true)}
        </span>
      </span>
    </div>
  )
}
