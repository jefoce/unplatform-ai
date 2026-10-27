'use client'

import {
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
} from 'react'
import { isEmpty } from 'lodash-es'

import { AUTOPLAY_DELAY_MS } from '@/core/constants'
import { cn } from '@/lib/cn'

import { LazyVideoPlayer } from './LazyVideoPlayer'
import { LazyVideoPoster } from './LazyVideoPoster'
import { useHoverPlay } from './use-hover-play'
import { type SeekKeys, usePlayerInput } from './use-player-input'
import { usePlayerSlot } from './use-player-slot'
import { useSlotLifecycle } from './use-slot-lifecycle'
import { useVideoState } from './use-video-state'

export interface LazyVideoProps {
  id: string
  src: string
  poster?: string
  aspect?: string
  className?: string
  alt?: string
  posterFit?: 'cover' | 'contain'
  videoFit?: 'cover' | 'contain'
  hoverPlay?: boolean
  seekKeys?: SeekKeys

  /** Acquires the slot on mount and starts playback. */
  autoPlay?: boolean

  /** False hides controls and releases the slot: selection mode owns the click. */
  interactive?: boolean
}

const NO_HANDLERS: ComponentProps<'div'> = {}

function fitClass(videoFit: 'cover' | 'contain', isFullscreen: boolean): string {
  if (isFullscreen || videoFit !== 'cover') {
    return 'object-contain'
  }

  return 'object-cover'
}

function tabIndexFor(isInteractive: boolean): number {
  if (isInteractive) {
    return 0
  }

  return -1
}

interface UseAutoPlayParams {
  id: string
  isEnabled: boolean
  isSlotActive: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  acquire: (id: string) => void
}

/** Acquires the slot after a short stay and starts playback once the video exists. */
function useAutoPlay(params: UseAutoPlayParams): void {
  const { id, isEnabled, isSlotActive, videoRef, acquire } = params

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const timer = setTimeout(() => {
      acquire(id)
    }, AUTOPLAY_DELAY_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [acquire, id, isEnabled])

  useEffect(() => {
    if (!isEnabled || !isSlotActive) {
      return
    }

    void videoRef.current?.play().catch(() => {})
  }, [isEnabled, isSlotActive, videoRef])
}

/**
 * Poster-only until the user plays it and the slot is active.
 * Only two videos stay loaded across the app. Hover mode keeps the slot on leave.
 */
export function LazyVideo(props: LazyVideoProps) {
  const {
    id,
    src,
    poster,
    aspect,
    className,
    alt,
    posterFit = 'contain',
    videoFit = 'contain',
    hoverPlay: isHoverPlay = false,
    seekKeys,
    autoPlay: isAutoPlayProp,
    interactive: isInteractive = true,
  } = props

  const isAutoPlay = Boolean(isAutoPlayProp)
  const { acquire, release, isActive } = usePlayerSlot()
  const isSlotActive = isActive(id)
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const video = useVideoState({ videoRef, rootRef, active: isSlotActive, src })
  const inputHandlers = usePlayerInput({ isActive: isSlotActive, video, seekKeys })

  useAutoPlay({ id, isEnabled: isAutoPlay, isSlotActive, videoRef, acquire })

  const hoverHandlers = useHoverPlay({
    id,
    src,
    isActive: isSlotActive,
    isEnabled: isHoverPlay,
    videoRef,
    acquire,
  })

  useSlotLifecycle({ id, rootRef, videoRef, isSlotActive, isInteractive, release })

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    acquire(id)
  }

  const fit = fitClass(videoFit, video.fullscreen)
  const shouldShowControls = isInteractive && !isHoverPlay
  const rootHandlers = shouldShowControls ? inputHandlers : NO_HANDLERS
  const rootStyle: CSSProperties = { aspectRatio: aspect }
  const tabIndex = tabIndexFor(isInteractive)

  return (
    <div
      ref={rootRef}
      tabIndex={tabIndex}
      {...rootHandlers}
      {...hoverHandlers}
      style={rootStyle}
      className={cn(
        'group/player relative overflow-hidden rounded-[inherit] bg-black outline-none',
        isEmpty(aspect) && 'h-full',
        className,
      )}
    >
      {isSlotActive && (
        <LazyVideoPlayer
          videoRef={videoRef}
          video={video}
          src={src}
          poster={poster}
          posterFit={posterFit}
          isHoverPlay={isHoverPlay}
          fit={fit}
          showControls={shouldShowControls}
        />
      )}
      {!isSlotActive && (
        <LazyVideoPoster
          poster={poster}
          alt={alt}
          posterFit={posterFit}
          showPlay={shouldShowControls}
          onPlay={handlePlay}
        />
      )}
    </div>
  )
}
