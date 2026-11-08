import type { Active, ClientRect, CollisionDetection, DroppableContainer } from '@dnd-kit/core'
import { isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { referenceCollisionDetection } from '@/features/generator/references/reference-collision'

type CollisionArgs = Parameters<CollisionDetection>[0]

interface ContainerSpec {
  id: string
  kind: string
  rect: ClientRect
}

interface ArgsSpec {
  kind?: string
  collisionRect: ClientRect
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
    data: { current: isNil(spec.kind) ? undefined : { kind: spec.kind } },
    rect: { current: { initial: spec.collisionRect, translated: spec.collisionRect } },
  }

  return {
    active,
    collisionRect: spec.collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates: null,
  }
}

function ids(args: CollisionArgs): (string | number)[] {
  return referenceCollisionDetection(args).map((collision) => {
    return collision.id
  })
}

describe('reference collision detection', () => {
  it('keeps an audio drag on audio containers even when an image is closer', () => {
    const args = collisionArgs({
      kind: 'audio',
      collisionRect: rect(0, 0, 10, 10),
      containers: [
        { id: 'audio', kind: 'audio', rect: rect(1000, 1000, 10, 10) },
        { id: 'image', kind: 'image', rect: rect(0, 0, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['audio'])
  })

  it('filters audio and video containers out of an image drag', () => {
    const args = collisionArgs({
      kind: 'image',
      collisionRect: rect(0, 0, 10, 10),
      containers: [
        { id: 'image', kind: 'image', rect: rect(0, 0, 10, 10) },
        { id: 'audio', kind: 'audio', rect: rect(20, 0, 10, 10) },
        { id: 'video', kind: 'video', rect: rect(40, 0, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['image'])
  })

  it('falls back to the unfiltered closest center without kind data', () => {
    const args = collisionArgs({
      collisionRect: rect(0, 0, 10, 10),
      containers: [
        { id: 'image', kind: 'image', rect: rect(0, 0, 10, 10) },
        { id: 'audio', kind: 'audio', rect: rect(500, 500, 10, 10) },
      ],
    })

    expect(ids(args)).toEqual(['image', 'audio'])
  })

  it('prefers an overlapping audio container over a closer center', () => {
    const args = collisionArgs({
      kind: 'audio',
      collisionRect: rect(0, 0, 100, 100),
      containers: [
        { id: 'overlap', kind: 'audio', rect: rect(95, 95, 100, 100) },
        { id: 'closer', kind: 'audio', rect: rect(0, 120, 100, 100) },
      ],
    })

    expect(ids(args)).toEqual(['overlap'])
  })
})
