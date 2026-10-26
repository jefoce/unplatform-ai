'use client'

import { type RefObject, useEffect, useState } from 'react'

import { useVideoEvents } from './use-video-events'
import { useVideoFullscreen } from './use-video-fullscreen'

interface VideoState {
  paused: boolean
  muted: boolean
  time: number
  duration: number
  fullscreen: boolean
}

interface VideoActions {
  togglePlay: () => void
  toggleMute: () => void
  seek: (seconds: number) => void
  seekBy: (delta: number) => void
  toggleFullscreen: () => void
}

export type VideoApi = VideoState & VideoActions

/**
 * Media state and actions for one video element.
 * Listeners attach only while the slot is active.
 */
interface UseVideoStateParams {
  videoRef: RefObject<HTMLVideoElement | null>
  rootRef: RefObject<HTMLDivElement | null>
  active: boolean
  src: string
}

export function useVideoState(params: UseVideoStateParams): VideoApi {
  const { videoRef, rootRef, active: isActive, src } = params
  const [isPaused, setIsPaused] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const { isFullscreen, toggleFullscreen } = useVideoFullscreen(rootRef, videoRef)

  useEffect(() => {
    const video = videoRef.current

    if (!isActive || !video) {
      return
    }

    // Restores src after StrictMode's simulated unmount.
    if (video.getAttribute('src') !== src) {
      video.src = src
    }

    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [isActive, src, videoRef])

  useVideoEvents({
    videoRef,
    isActive,
    src,
    onTime: setTime,
    onDuration: setDuration,
    onPaused: setIsPaused,
    onMuted: setIsMuted,
  })

  const togglePlay = () => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (video.paused) {
      void video.play().catch(() => {
        setIsPaused(true)
      })
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current

    if (video) {
      video.muted = !video.muted
    }
  }

  const seek = (seconds: number) => {
    const video = videoRef.current

    if (!video || !Number.isFinite(seconds)) {
      return
    }

    video.currentTime = seconds
    setTime(seconds)
  }

  const seekBy = (delta: number) => {
    const video = videoRef.current

    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      return
    }

    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + delta))
    setTime(video.currentTime)
  }

  return {
    paused: isPaused,
    muted: isMuted,
    time,
    duration,
    fullscreen: isFullscreen,
    togglePlay,
    toggleMute,
    seek,
    seekBy,
    toggleFullscreen,
  }
}
