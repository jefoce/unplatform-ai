'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'
import { Pause, Play } from 'lucide-react'

import { AUTOPLAY_DELAY_MS } from '@/core/constants'
import type { UploadItem } from '@/core/schemas/upload-item'
import {
  currentDuration,
  currentSrc,
  pauseAudio,
  playAudio,
  useAudioPlaying,
  useAudioTime,
} from '@/lib/audio-player'
import { formatClock } from '@/lib/format'
import { waveBars } from '@/lib/wave-bars'

import { PreviewAudioWave } from './PreviewAudioWave'

const AUDIO_BARS = 80

interface PreviewAudioProps {
  item: UploadItem
  src: string
}

/** Uses the shared audio element so preview never adds a second player. */
export function PreviewAudio(props: PreviewAudioProps) {
  const { item, src } = props
  const isPlaying = useAudioPlaying(src)
  const elapsed = useAudioTime(src)
  let total = item.durationSec ?? 0

  if (isNil(item.durationSec) && currentSrc() === src) {
    total = currentDuration()
  }

  const isProgress = isNil(elapsed) || total === 0

  const progress = isProgress ? 0 : elapsed / total
  const played = Math.min(1, progress)
  const bars = waveBars(item.originalName, AUDIO_BARS)
  const at = elapsed ?? 0

  const handleToggle = () => {
    if (isPlaying) {
      pauseAudio()
    } else {
      playAudio(src)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      playAudio(src)
    }, AUTOPLAY_DELAY_MS)

    return () => {
      clearTimeout(timer)

      if (currentSrc() === src) {
        pauseAudio()
      }
    }
  }, [src])

  const PlayIcon = isPlaying ? Pause : Play
  const playLabel = isPlaying ? 'Pause' : 'Play'

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl bg-surface p-4">
      <span className="truncate text-sm font-semibold">{item.originalName}</span>

      <PreviewAudioWave bars={bars} played={played} at={at} total={total} onToggle={handleToggle} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={`${playLabel} ${item.originalName}`}
          className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-fg backdrop-blur-sm transition hover:bg-black/60"
        >
          <PlayIcon size={16} className="fill-current" aria-hidden />
        </button>
        <span className="text-xs text-fg-2 tabular-nums">
          {formatClock(elapsed ?? 0)} / {formatClock(total)}
        </span>
      </div>
    </div>
  )
}
