'use client'

import type { RefObject } from 'react'

import { cn } from '@/lib/cn'

import { LazyVideoPlayButton } from './LazyVideoPlayButton'
import { PlayerControls } from './PlayerControls'
import type { VideoApi } from './use-video-state'

interface LazyVideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>
  video: VideoApi
  src: string
  poster?: string
  isHoverPlay: boolean
  fit: string
  showControls: boolean
}

/** Active video element with its overlay controls. */
export function LazyVideoPlayer(props: LazyVideoPlayerProps) {
  const { videoRef, video, src, poster, isHoverPlay, fit, showControls: shouldShowControls } = props
  const { togglePlay } = video

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        muted={isHoverPlay}
        loop={isHoverPlay}
        preload="metadata"
        className={cn('size-full bg-black', fit)}
      />
      {shouldShowControls && video.paused && (
        <LazyVideoPlayButton label="Play" onPlay={togglePlay} />
      )}
      {shouldShowControls && <PlayerControls video={video} />}
    </>
  )
}
