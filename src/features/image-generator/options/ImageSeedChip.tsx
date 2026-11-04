'use client'

import { SeedControl } from '@/features/generator/options/SeedControl'

import { currentImagePreset } from '../preset'
import { useImageGeneratorStore } from '../store'

/** Random / fixed seed chip for the image bar. Hidden when the model has no seed. */
export function ImageSeedChip() {
  const seed = useImageGeneratorStore((state) => {
    return state.seed
  })

  const setSeed = useImageGeneratorStore((state) => {
    return state.setSeed
  })

  const preset = currentImagePreset(
    useImageGeneratorStore((state) => {
      return state.presetId
    }),
  )

  if (!preset.seed) {
    return null
  }

  return <SeedControl size="bar" seed={seed} onChange={setSeed} />
}
