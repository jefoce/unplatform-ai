// @vitest-environment jsdom
import type { DragEndEvent } from '@dnd-kit/core'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { MediaKind } from '@/core/media/media-types'
import { referenceSlots, type RefSlot } from '@/core/prompt-tokens'
import { useReferencesDnd } from '@/features/generator/references/use-references-dnd'
import { useGeneratorStore } from '@/features/generator/store/store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const image1 = upload('image-1', 'image')
const image2 = upload('image-2', 'image')
const video = upload('video-1', 'video')
const audio1 = upload('audio-1', 'audio')
const audio2 = upload('audio-2', 'audio')

const ALL = uploadsOf(image1, image2, video, audio1, audio2)

function kindOf(id: string): MediaKind | undefined {
  return ALL[id]?.kind
}

function dragEvent(activeId: string, overId: string): DragEndEvent {
  const active = {
    id: activeId,
    rect: { current: { initial: null, translated: null } },
    data: { current: undefined },
  }

  const over = {
    id: overId,
    rect: { current: null },
    data: { current: undefined },
  }

  return {
    active,
    over,
    activatorEvent: new Event('pointerup'),
    collisions: null,
    delta: { x: 0, y: 0 },
  } as unknown as DragEndEvent
}

function seed(order: string[]): void {
  useGeneratorStore.setState({ references: order, uploadsById: ALL })
}

function slotOf(order: string[], id: string): RefSlot | undefined {
  return referenceSlots(order, kindOf).slots.get(id)
}

beforeEach(() => {
  seed([])
})

afterEach(() => {
  cleanup()
  useGeneratorStore.setState({ references: [], uploadsById: {} })
  localStorage.clear()
})

describe('reference drag order', () => {
  it('moves an image after the audio references', () => {
    const order = [image1.id, image2.id, audio1.id, audio2.id]

    seed(order)

    const { result } = renderHook(() => {
      return useReferencesDnd(order)
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(image1.id, audio2.id))
    })

    const after = [image2.id, audio1.id, audio2.id, image1.id]

    expect(useGeneratorStore.getState().references).toEqual(after)
    expect(slotOf(after, image2.id)).toEqual({ kind: 'image', n: 1 })
    expect(slotOf(after, image1.id)).toEqual({ kind: 'image', n: 2 })
    expect(slotOf(after, audio1.id)).toEqual({ kind: 'audio', n: 1 })
    expect(slotOf(after, audio2.id)).toEqual({ kind: 'audio', n: 2 })
  })

  it('moves an audio reference before the images', () => {
    const order = [image1.id, image2.id, audio1.id, audio2.id]

    seed(order)

    const { result } = renderHook(() => {
      return useReferencesDnd(order)
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(audio2.id, image1.id))
    })

    const after = [audio2.id, image1.id, image2.id, audio1.id]

    expect(useGeneratorStore.getState().references).toEqual(after)
    expect(slotOf(after, audio2.id)).toEqual({ kind: 'audio', n: 1 })
    expect(slotOf(after, audio1.id)).toEqual({ kind: 'audio', n: 2 })
    expect(slotOf(after, image1.id)).toEqual({ kind: 'image', n: 1 })
    expect(slotOf(after, image2.id)).toEqual({ kind: 'image', n: 2 })
  })

  it('moves a video between two images', () => {
    const order = [image1.id, image2.id, audio1.id, video.id]

    seed(order)

    const { result } = renderHook(() => {
      return useReferencesDnd(order)
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(video.id, image2.id))
    })

    const after = [image1.id, video.id, image2.id, audio1.id]

    expect(useGeneratorStore.getState().references).toEqual(after)
    expect(slotOf(after, video.id)).toEqual({ kind: 'video', n: 1 })
    expect(slotOf(after, image1.id)).toEqual({ kind: 'image', n: 1 })
    expect(slotOf(after, image2.id)).toEqual({ kind: 'image', n: 2 })
    expect(slotOf(after, audio1.id)).toEqual({ kind: 'audio', n: 1 })
  })
})
