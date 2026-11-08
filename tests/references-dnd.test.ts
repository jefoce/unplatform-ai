// @vitest-environment jsdom
import type { ClientRect, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PixelSize } from '@/core/media/geometry'
import { useReferencesDnd } from '@/features/generator/references/use-references-dnd'
import { useGeneratorStore } from '@/features/generator/store/store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const image = upload('image-1', 'image')
const video = upload('video-1', 'video')
const audio1 = upload('audio-1', 'audio')
const audio2 = upload('audio-2', 'audio')

const IDS = [image.id, video.id, audio1.id, audio2.id]

function clientRect(size: PixelSize): ClientRect {
  return {
    width: size.width,
    height: size.height,
    top: 0,
    left: 0,
    right: size.width,
    bottom: size.height,
  }
}

function startEvent(id: string, size: PixelSize): DragStartEvent {
  const rect = { current: { initial: clientRect(size), translated: null } }

  return { active: { id, rect, data: { current: undefined } } } as unknown as DragStartEvent
}

function dragEvent(activeId: string, overId: string): DragEndEvent {
  const active = {
    id: activeId,
    rect: { current: { initial: clientRect({ width: 1, height: 1 }), translated: null } },
    data: { current: undefined },
  }

  const over = {
    id: overId,
    rect: clientRect({ width: 1, height: 1 }),
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

beforeEach(() => {
  useGeneratorStore.setState({
    references: IDS,
    uploadsById: uploadsOf(image, video, audio1, audio2),
  })
})

afterEach(() => {
  cleanup()
  useGeneratorStore.setState({ references: [], uploadsById: {} })
  localStorage.clear()
})

describe('reference drag order', () => {
  it('reorders audio after audio and keeps images and videos in place', () => {
    const { result } = renderHook(() => {
      return useReferencesDnd(IDS)
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(audio1.id, audio2.id))
    })

    expect(useGeneratorStore.getState().references).toEqual([
      image.id,
      video.id,
      audio2.id,
      audio1.id,
    ])
  })

  it('ignores a drop on another kind', () => {
    const { result } = renderHook(() => {
      return useReferencesDnd(IDS)
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(audio1.id, video.id))
    })

    expect(useGeneratorStore.getState().references).toEqual(IDS)
  })

  it('keeps the preview order when hovering another kind', () => {
    const { result } = renderHook(() => {
      return useReferencesDnd(IDS)
    })

    act(() => {
      result.current.handleDragStart(startEvent(audio1.id, { width: 120, height: 56 }))
    })

    expect(result.current.activeSize).toEqual({ width: 120, height: 56 })

    act(() => {
      result.current.handleDragOver(dragEvent(audio1.id, image.id))
    })

    expect(result.current.order).toEqual(IDS)

    act(() => {
      result.current.handleDragOver(dragEvent(audio1.id, audio2.id))
    })

    expect(result.current.order).toEqual([image.id, video.id, audio2.id, audio1.id])
  })
})
