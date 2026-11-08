import { closestCenter, type CollisionDetection, rectIntersection } from '@dnd-kit/core'
import { isNil } from 'lodash-es'

/**
 * Collision detection limited to droppables of the active item's kind.
 * Audio prefers an overlapping tile, every kind falls back to the closest center.
 */
export const referenceCollisionDetection: CollisionDetection = (args) => {
  const kind: unknown = args.active.data.current?.kind

  if (isNil(kind)) {
    return closestCenter(args)
  }

  const droppableContainers = args.droppableContainers.filter((container) => {
    return container.data.current?.kind === kind
  })

  if (droppableContainers.length === 0) {
    return []
  }

  const filtered = { ...args, droppableContainers }

  if (kind === 'audio') {
    const hits = rectIntersection(filtered)

    if (hits.length > 0) {
      return hits
    }
  }

  return closestCenter(filtered)
}
