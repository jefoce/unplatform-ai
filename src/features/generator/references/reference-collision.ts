import { closestCenter, type CollisionDetection, pointerWithin } from '@dnd-kit/core'

/**
 * Pointer hit first, closest center for keyboard sorting and pointer misses.
 * Every kind shares the same droppable set.
 */
export const referenceCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)

  if (hits.length > 0) {
    return hits
  }

  return closestCenter(args)
}
