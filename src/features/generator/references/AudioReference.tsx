'use client'

import { type MouseEvent } from 'react'
import { isNil } from 'lodash-es'
import { Pause, Play } from 'lucide-react'

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
  let total = upload.durationSec ?? 0

  if (isNil(upload.durationSec) && currentSrc() === src) {
    total = currentDuration()
  }

  const isPlayed = !isNil(elapsed) && total > 0

  const played = isPlayed ? elapsed / total : 0
  const bars = waveBars(upload.originalName, AUDIO_BARS)

  const handleTogglePlay = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()

    if (isPlaying) {
      pauseAudio()
    } else {
      playAudio(src)
    }
  }

  const PlayIcon = isPlaying ? Pause : Play
  const playLabel = isPlaying ? 'Pause' : 'Play'

  return (
    <div className="flex size-full flex-col justify-between overflow-hidden rounded-xl bg-white/10 px-1.5 py-1">
      <span className="flex h-4 w-full items-end gap-px">
        {bars.map((height, index) => {
          return (
            <span
              /* eslint-disable-next-line react/no-array-index-key -- static list */
              key={index}
              style={{ height: `${height}%` }}
              className={cn(
                'flex-1 rounded-full',
                index / bars.length < played && 'bg-lime',
                !(index / bars.length < played) && 'bg-fg-2/60',
              )}
            />
          )
        })}
      </span>
      <span className="flex h-4 items-center justify-between">
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={`${playLabel} ${name}`}
          className="flex size-4 items-center justify-center rounded-full bg-black/40 text-fg hover:bg-black/60"
        >
          <PlayIcon size={10} className="fill-current" aria-hidden />
        </button>
        <span className="text-xxs leading-none text-white/50 tabular-nums">
          {formatMediaDuration(elapsed ?? total, true)}
        </span>
      </span>
    </div>
  )
}
