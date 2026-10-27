'use client'

import type { KeyboardEvent, MouseEvent } from 'react'

import { isOwnEvent } from '@/lib/events'

import type { VideoApi } from './use-video-state'

export type SeekKeys = 'arrows' | 'shiftArrows'

interface UsePlayerInputParams {
  isActive: boolean
  video: VideoApi
  seekKeys?: SeekKeys
}

interface PlayerInputHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onClick: (event: MouseEvent<HTMLDivElement>) => void
}

/** Keyboard and click shortcuts for the player root. */
export function usePlayerInput(params: UsePlayerInputParams): PlayerInputHandlers {
  const { isActive, video, seekKeys = 'arrows' } = params

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isOwnEvent(event) || event.target !== event.currentTarget) {
      return
    }

    if (event.code === 'Space') {
      event.preventDefault()
      video.togglePlay()

      return
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      video.toggleFullscreen()

      return
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    if (seekKeys === 'shiftArrows' && !event.shiftKey) {
      return
    }

    event.preventDefault()

    const delta = event.key === 'ArrowLeft' ? -5 : 5

    video.seekBy(delta)
  }

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!isOwnEvent(event) || event.shiftKey || !isActive) {
      return
    }

    if ((event.target as HTMLElement).closest('button, a, input')) {
      return
    }

    event.stopPropagation()
    video.togglePlay()
  }

  return { onKeyDown, onClick }
}
