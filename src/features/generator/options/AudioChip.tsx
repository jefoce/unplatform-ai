'use client'

import { Volume2, VolumeX } from 'lucide-react'

import { getPreset } from '@/core/presets'
import { Chip } from '@/ui/Chip'

import { useGeneratorStore } from '../store/store'

/** Prompt audio toggle chip. Hidden when the model has no audio. */
export function AudioChip() {
  const isAudio = useGeneratorStore((state) => {
    return state.audio
  })

  const setAudio = useGeneratorStore((state) => {
    return state.setAudio
  })

  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const handleToggle = (): void => {
    setAudio(!isAudio)
  }

  if (!preset.audio.supported) {
    return null
  }

  const AudioIcon = isAudio ? Volume2 : VolumeX
  const label = isAudio ? 'On' : 'Off'

  return (
    <Chip onClick={handleToggle} aria-pressed={isAudio}>
      <AudioIcon size={14} aria-hidden />
      {label}
    </Chip>
  )
}
