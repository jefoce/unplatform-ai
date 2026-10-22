'use client'

import { type RefObject, useEffect, useState } from 'react'

interface UseVideoFullscreen {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

/** Fullscreen state and toggle for a player root, with the webkit video fallback. */
export function useVideoFullscreen(
  rootRef: RefObject<HTMLDivElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
): UseVideoFullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)

    document.addEventListener('fullscreenchange', onChange)

    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [rootRef])

  const toggleFullscreen = () => {
    const node = rootRef.current
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- webkitEnterFullscreen missing from lib.dom
    const video = videoRef.current as
      (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    const run = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()

          return
        }

        if (node?.requestFullscreen) {
          await node.requestFullscreen()

          return
        }

        video?.webkitEnterFullscreen?.()
      } catch {
        // Fullscreen is not available in this webview.
      }
    }

    void run()
  }

  return { isFullscreen, toggleFullscreen }
}
