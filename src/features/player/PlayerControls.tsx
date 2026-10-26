'use client'

import { type ChangeEvent, type CSSProperties, type MouseEvent } from 'react'
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

import type { VideoApi } from './use-video-state'

const CONTROL_BUTTON_CLASSES =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10'

const SEEK_CLASSES = [
  'h-4 w-full cursor-pointer appearance-none bg-transparent',
  '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-lime)_var(--progress),rgba(255,255,255,0.24)_var(--progress))]',
  '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:[margin-top:-3px]',
  '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-lime)_var(--progress),rgba(255,255,255,0.24)_var(--progress))]',
  '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
].join(' ')

const HOVER_REVEAL_CLASSES =
  'pointer-events-none opacity-0 group-hover/player:pointer-events-auto group-hover/player:opacity-100 group-has-[:focus-visible]/player:pointer-events-auto group-has-[:focus-visible]/player:opacity-100'

interface PlayerControlsProps {
  video: VideoApi
}

function handleStopPropagation(event: MouseEvent<HTMLDivElement>): void {
  event.stopPropagation()
}

/** Bottom bar with seek, play, mute, clock and fullscreen. Hides while playing until hover. */
export function PlayerControls(props: PlayerControlsProps) {
  const { video } = props

  const {
    paused: isPaused,
    muted: isMuted,
    time,
    duration,
    fullscreen: isFullscreen,
    togglePlay,
    toggleMute,
    toggleFullscreen,
  } = video

  const rawProgress = duration > 0 ? (time / duration) * 100 : 0
  const progress = Math.min(100, rawProgress)

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    video.seek(Number(event.currentTarget.value))
  }

  const PlayIcon = isPaused ? Play : Pause
  const MuteIcon = isMuted ? VolumeX : Volume2
  const FullscreenIcon = isFullscreen ? Minimize : Maximize
  const playLabel = isPaused ? 'Play' : 'Pause'
  const muteLabel = isMuted ? 'Unmute' : 'Mute'
  const fullscreenLabel = isFullscreen ? 'Exit fullscreen' : 'Fullscreen'

  return (
    <div
      onClick={handleStopPropagation}
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 flex h-22 flex-col justify-end gap-2 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 transition-opacity duration-150',
        !isPaused && HOVER_REVEAL_CLASSES,
      )}
    >
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={duration}
        step="any"
        value={Math.min(time, duration)}
        disabled={duration === 0 || Number.isNaN(duration)}
        onChange={handleSeek}
        style={{ '--progress': `${progress}%` } as CSSProperties}
        className={SEEK_CLASSES}
      />
      <div className="flex items-center gap-1.5 text-xs text-white/80">
        <button
          type="button"
          aria-label={playLabel}
          onClick={togglePlay}
          className={CONTROL_BUTTON_CLASSES}
        >
          <PlayIcon size={16} className="fill-current" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={muteLabel}
          onClick={toggleMute}
          className={CONTROL_BUTTON_CLASSES}
        >
          <MuteIcon size={16} aria-hidden />
        </button>
        <span className="ml-1 tabular-nums">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <button
          type="button"
          aria-label={fullscreenLabel}
          onClick={toggleFullscreen}
          className={cn(CONTROL_BUTTON_CLASSES, 'ml-auto')}
        >
          <FullscreenIcon size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
