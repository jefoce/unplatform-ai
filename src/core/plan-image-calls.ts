import type { ImagePreset } from './presets/image/types'

/**
 * Splits a requested count into provider calls of at most `preset.maxN` images.
 * Seeded presets send one image per call so every output gets its own seed.
 */
export function planImageCalls(count: number, preset: ImagePreset): readonly number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${String(count)}`)
  }

  if (!Number.isInteger(preset.maxN) || preset.maxN < 1) {
    throw new RangeError(`maxN must be a positive integer, got ${String(preset.maxN)}`)
  }

  const calls: number[] = []
  const isSeeded = preset.params.includes('seed')
  const maxN = isSeeded ? 1 : preset.maxN
  let remaining = count

  while (remaining > 0) {
    const n = Math.min(remaining, maxN)

    calls.push(n)
    remaining -= n
  }

  return calls
}
