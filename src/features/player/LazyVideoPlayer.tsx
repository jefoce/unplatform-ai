'use client'

import { type RefObject, useState } from 'react'
import { isEmpty } from 'lodash-es'

import { cn } from '@/lib/cn'

import { LazyVideoPlayButton } from './LazyVideoPlayButton'
import { PlayerControls } from './PlayerControls'
import type { VideoApi } from './use-video-state'

const POSTER_FIT_CLASS = {
  cover: 'object-cover',
  contain: 'object-contain',
} as const

interface LazyVideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>
  video: VideoApi
  src: string
  poster?: string
  posterFit: 'cover' | 'contain'
  isHoverPlay: boolean
  fit: string
  showControls: boolean
}

/** Active video element with its overlay controls. */
export function LazyVideoPlayer(props: LazyVideoPlayerProps) {
  const {
    videoRef,
    video,
    src,
    poster,
    posterFit,
    isHoverPlay,
    fit,
    showControls: shouldShowControls,
  } = props

  const { togglePlay } = video

  const [hasPlayed, setHasPlayed] = useState(false)

  const handlePlaying = () => {
    setHasPlayed(true)
  }

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        muted={isHoverPlay}
        loop
        preload="metadata"
        onPlaying={handlePlaying}
        className={cn('size-full rounded-[inherit] bg-black', fit)}
      />
      {!isEmpty(poster) && (
        // eslint-disable-next-line @next/next/no-img-element -- poster overlay, pre-sized thumb
        <img
          src={poster}
          alt=""
          aria-hidden
          draggable={false}
          className={cn(
            'pointer-events-none absolute inset-0 size-full rounded-[inherit] bg-black transition-opacity duration-150',
            POSTER_FIT_CLASS[posterFit],
            hasPlayed && 'opacity-0',
          )}
        />
      )}
      {shouldShowControls && video.paused && (
        <LazyVideoPlayButton label="Play" onPlay={togglePlay} />
      )}
      {shouldShowControls && <PlayerControls video={video} />}
    </>
  )
}
