'use client'

import { getPreset } from '@/core/presets'

import { useGeneratorStore } from '../store/store'
import { SeedControl } from './SeedControl'

/** Random / fixed seed chip for the video bar. Hidden when the model has no seed. */
export function SeedChip() {
  const seed = useGeneratorStore((state) => {
    return state.seed
  })

  const setSeed = useGeneratorStore((state) => {
    return state.setSeed
  })

  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  if (!preset.seed) {
    return null
  }

  return <SeedControl seed={seed} onChange={setSeed} />
}
