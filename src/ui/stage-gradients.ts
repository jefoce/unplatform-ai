export const STAGE_GRADIENTS = [
  'bg-linear-to-br from-lime to-teal',
  'bg-linear-to-br from-violet to-favorite',
  'bg-linear-to-br from-amber to-warn',
  'bg-linear-to-br from-info to-indigo',
  'bg-linear-to-br from-teal to-info',
  'bg-linear-to-br from-favorite to-amber',
] as const

export type StageGradient = (typeof STAGE_GRADIENTS)[number]

/** Stable gradient for one seed, so the same item always looks the same. */
export function stageGradient(seed: string): StageGradient {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }

  const gradient = STAGE_GRADIENTS[Math.abs(hash) % STAGE_GRADIENTS.length]

  return gradient ?? STAGE_GRADIENTS[0]
}
