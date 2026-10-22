'use client'

import { useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

import { getPreset } from '@/core/presets'
import { Chip } from '@/ui/Chip'

import { useGeneratorStore } from './store'

/** Prompt audio toggle chip. Hidden when the model has no audio. */
export function AudioChip() {
  const isAudio = useGeneratorStore((state) => state.audio)
  const setAudio = useGeneratorStore((state) => state.setAudio)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const handleToggle = useCallback((): void => setAudio(!isAudio), [isAudio, setAudio])

  if (!preset.audio.supported) return null

  return (
    <Chip onClick={handleToggle} aria-pressed={isAudio}>
      {isAudio ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
      {isAudio ? 'On' : 'Off'}
    </Chip>
  )
}
