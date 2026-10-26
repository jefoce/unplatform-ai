'use client'

import { useSyncExternalStore } from 'react'
import { isNil } from 'lodash-es'

type Listener = () => void

let audio: HTMLAudioElement | null = null
let current = ''
let isPlayingNow = false
let time = 0
let length = 0
const listeners = new Set<Listener>()

function notify(): void {
  isPlayingNow = Boolean(audio && !audio.paused)

  for (const listener of listeners) {
    listener()
  }
}

function syncTime(): void {
  time = audio?.currentTime ?? 0
  length = 0

  if (!isNil(audio) && Number.isFinite(audio.duration)) {
    length = audio.duration
  }

  notify()
}

function element(): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null
  }

  if (audio) {
    return audio
  }

  const next = new Audio()

  for (const event of ['play', 'pause', 'ended'] as const) {
    next.addEventListener(event, notify)
  }

  next.addEventListener('timeupdate', syncTime)
  next.addEventListener('loadedmetadata', syncTime)
  audio = next

  return next
}

/** Plays one source at a time, replacing whatever was playing. */
export function playAudio(src: string): void {
  const player = element()

  if (!player) {
    return
  }

  if (current !== src) {
    player.pause()
    current = src
    time = 0
    length = 0
    player.src = src
  } else if (player.ended) {
    player.currentTime = 0
    time = 0
  }

  void player.play().catch(() => {
    notify()
  })
}

/** Duration of the loaded source in seconds, 0 when unknown. */
export function currentDuration(): number {
  return length
}

export function pauseAudio(): void {
  element()?.pause()
}

/** Seeks the loaded source, clamped to [0, duration]. */
export function seekAudio(seconds: number): void {
  const player = element()

  if (!player || current === '') {
    return
  }

  const isMax = Number.isFinite(player.duration)

  const max = isMax ? player.duration : length

  player.currentTime = Math.min(Math.max(seconds, 0), max)
  syncTime()
}

/** Source currently loaded, playing or paused. */
export function currentSrc(): string {
  return current
}

function isPlaying(src: string): boolean {
  return current === src && isPlayingNow
}

/** Notifies on play, pause and ended of the shared element. */
function subscribe(listener: Listener): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

/** True while the shared player is playing `src`. */
export function useAudioPlaying(src: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      return isPlaying(src)
    },
    () => {
      return false
    },
  )
}

/** Elapsed seconds while `src` is loaded (playing or paused), else null. */
export function useAudioTime(src: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (current === src && src !== '') {
        return time
      }

      return null
    },
    () => {
      return null
    },
  )
}
