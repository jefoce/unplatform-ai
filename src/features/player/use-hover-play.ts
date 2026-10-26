'use client'

import { type RefObject, useCallback, useEffect, useRef } from 'react'

interface UseHoverPlayParams {
  id: string
  src: string
  isActive: boolean
  isEnabled: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  acquire: (id: string) => void
}

interface HoverPlayHandlers {
  onPointerEnter: () => void
  onPointerLeave: () => void
  onFocus: () => void
  onBlur: () => void
}

function playIfPaused(element: HTMLVideoElement | null): void {
  if (element?.paused === true) {
    void element.play().catch(() => {})
  }
}

/** Hover playback that survives pointer leave, so a re-hover resumes the same slot. */
export function useHoverPlay(params: UseHoverPlayParams): HoverPlayHandlers {
  const { id, src, isActive, isEnabled, videoRef, acquire } = params
  const pointerInside = useRef(false)
  const focusInside = useRef(false)

  const setInside = useCallback(
    (ref: RefObject<boolean>, isInside: boolean) => {
      if (!isEnabled) {
        return
      }

      ref.current = isInside

      if (isInside) {
        acquire(id)
        playIfPaused(videoRef.current)

        return
      }

      if (!pointerInside.current && !focusInside.current) {
        videoRef.current?.pause()
      }
    },
    [acquire, isEnabled, id, videoRef],
  )

  const handleHoverEnter = useCallback(() => {
    setInside(pointerInside, true)
  }, [setInside])

  const handleHoverLeave = useCallback(() => {
    setInside(pointerInside, false)
  }, [setInside])

  const handleFocus = useCallback(() => {
    setInside(focusInside, true)
  }, [setInside])

  const handleBlur = useCallback(() => {
    setInside(focusInside, false)
  }, [setInside])

  useEffect(() => {
    const element = videoRef.current

    if (!isEnabled || !isActive || !element) {
      return
    }

    if (pointerInside.current || focusInside.current) {
      playIfPaused(element)
    } else {
      element.pause()
    }
  }, [isEnabled, isActive, src, videoRef])

  return {
    onPointerEnter: handleHoverEnter,
    onPointerLeave: handleHoverLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  }
}
