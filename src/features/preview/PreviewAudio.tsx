'use client'

import { useCallback, useEffect } from 'react'
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
  const total = item.durationSec ?? (currentSrc() === src ? currentDuration() : 0)
  const progress = isNil(elapsed) || total === 0 ? 0 : elapsed / total
  const played = Math.min(1, progress)
  const bars = waveBars(item.originalName, AUDIO_BARS)
  const at = elapsed ?? 0
  const handleToggle = useCallback(() => {
    if (isPlaying) pauseAudio()
    else playAudio(src)
  }, [isPlaying, src])

  useEffect(() => {
    playAudio(src)

    return () => {
      if (currentSrc() === src) pauseAudio()
    }
  }, [src])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl bg-surface p-4">
      <span className="truncate text-sm font-semibold">{item.originalName}</span>

      <PreviewAudioWave bars={bars} played={played} at={at} total={total} onToggle={handleToggle} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${item.originalName}`}
          className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-fg backdrop-blur-sm transition hover:bg-black/60"
        >
          {isPlaying ? (
            <Pause size={16} className="fill-current" aria-hidden />
          ) : (
            <Play size={16} className="fill-current" aria-hidden />
          )}
        </button>
        <span className="text-xs text-fg-2 tabular-nums">
          {formatClock(elapsed ?? 0)} / {formatClock(total)}
        </span>
      </div>
    </div>
  )
}
