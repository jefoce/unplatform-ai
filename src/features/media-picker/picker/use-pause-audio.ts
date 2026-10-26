'use client'

import { useEffect } from 'react'

import { pauseAudio } from '@/lib/audio-player'

/** Stops the player when the picker unmounts. */
export function usePauseAudioOnUnmount(): void {
  useEffect(() => {
    return () => {
      pauseAudio()
    }
  }, [])
}
