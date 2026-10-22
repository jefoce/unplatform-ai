'use client'

import { type RefObject, useEffect } from 'react'

interface UseVideoEventsParams {
  videoRef: RefObject<HTMLVideoElement | null>
  isActive: boolean
  src: string
  onTime: (seconds: number) => void
  onDuration: (seconds: number) => void
  onPaused: (isPaused: boolean) => void
  onMuted: (isMuted: boolean) => void
}

/** Attaches media listeners while the slot is active and syncs the initial state. */
export function useVideoEvents(params: UseVideoEventsParams): void {
  const { videoRef, isActive, src, onTime, onDuration, onPaused, onMuted } = params

  useEffect(() => {
    const video = videoRef.current

    if (!isActive || !video) return

    onTime(0)
    onDuration(0)
    onPaused(video.paused)
    onMuted(video.muted)

    const syncTime = () => onTime(video.currentTime)
    const syncDuration = () => onDuration(Number.isFinite(video.duration) ? video.duration : 0)
    const syncPaused = () => onPaused(video.paused)
    const syncMuted = () => onMuted(video.muted)

    video.addEventListener('timeupdate', syncTime)
    video.addEventListener('loadedmetadata', syncDuration)
    video.addEventListener('durationchange', syncDuration)
    video.addEventListener('play', syncPaused)
    video.addEventListener('pause', syncPaused)
    video.addEventListener('ended', syncPaused)
    video.addEventListener('volumechange', syncMuted)
    syncDuration()

    return () => {
      video.removeEventListener('timeupdate', syncTime)
      video.removeEventListener('loadedmetadata', syncDuration)
      video.removeEventListener('durationchange', syncDuration)
      video.removeEventListener('play', syncPaused)
      video.removeEventListener('pause', syncPaused)
      video.removeEventListener('ended', syncPaused)
      video.removeEventListener('volumechange', syncMuted)
    }
  }, [isActive, onDuration, onMuted, onPaused, onTime, src, videoRef])
}
