import type { Active, ClientRect, CollisionDetection, DroppableContainer } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'

import { referenceCollisionDetection } from '@/features/generator/references/reference-collision'

type CollisionArgs = Parameters<CollisionDetection>[0]

interface ContainerSpec {
  id: string
  kind: string
  rect: ClientRect
}

interface ArgsSpec {
  activeKind?: string
  collisionRect: ClientRect
  pointerCoordinates?: { x: number; y: number } | null
  containers: ContainerSpec[]
}

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return {
    width,
    height,
    top,
    left,
    right: left + width,
    bottom: top + height,
  }
}

function container(spec: ContainerSpec): DroppableContainer {
  return {
    id: spec.id,
    key: spec.id,
    data: { current: { kind: spec.kind } },
    disabled: false,
    node: { current: null },
    rect: { current: spec.rect },
  }
}

function collisionArgs(spec: ArgsSpec): CollisionArgs {
  const droppableContainers = spec.containers.map(container)

  const droppableRects = new Map<string | number, ClientRect>(
    spec.containers.map((item) => {
      return [item.id, item.rect]
    }),
  )

  const active: Active = {
    id: 'active',
    data: { current: spec.activeKind === undefined ? undefined : { kind: spec.activeKind } },
    rect: { current: { initial: spec.collisionRect, translated: spec.collisionRect } },
  }

  return {
    active,
    collisionRect: spec.collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates: spec.pointerCoordinates ?? null,
  }
}

function ids(args: CollisionArgs): (string | number)[] {
  return referenceCollisionDetection(args).map((collision) => {
    return collision.id
  })
}

describe('reference collision detection', () => {
  it('returns the container under the pointer', () => {
    const args = collisionArgs({
      collisionRect: rect(0, 0, 10, 10),
      pointerCoordinates: { x: 5, y: 5 },
      containers: [
        { id: 'image', kind: 'image', rect: rect(0, 0, 10, 10) },
        { id: 'audio', kind: 'audio', rect: rect(100, 0, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['image'])
  })

  it('falls back to the closest center without a pointer hit', () => {
    const args = collisionArgs({
      collisionRect: rect(0, 0, 10, 10),
      pointerCoordinates: { x: 500, y: 500 },
      containers: [
        { id: 'image', kind: 'image', rect: rect(0, 0, 10, 10) },
        { id: 'audio', kind: 'audio', rect: rect(100, 0, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['image', 'audio'])
  })

  it('lets an image drag collide with an audio container', () => {
    const args = collisionArgs({
      activeKind: 'image',
      collisionRect: rect(20, 0, 10, 10),
      pointerCoordinates: { x: 25, y: 5 },
      containers: [
        { id: 'image', kind: 'image', rect: rect(1000, 0, 10, 10) },
        { id: 'audio', kind: 'audio', rect: rect(20, 0, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['audio'])
  })
})
