// @vitest-environment jsdom
import type { DragEndEvent } from '@dnd-kit/core'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useImageGeneratorStore } from '@/features/image-generator/store'
import { useImageReferencesDnd } from '@/features/image-generator/use-image-references-dnd'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const first = upload('image-1', 'image')
const second = upload('image-2', 'image')
const third = upload('image-3', 'image')

const IDS = [first.id, second.id, third.id]

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

beforeEach(() => {
  useImageGeneratorStore.setState({
    references: IDS,
    uploadsById: uploadsOf(first, second, third),
  })
})

afterEach(() => {
  cleanup()
  useImageGeneratorStore.setState({ references: [], uploadsById: {} })
  localStorage.clear()
})

describe('image reference drag order', () => {
  it('reorders the chips live while dragging', () => {
    const { result } = renderHook(() => {
      return useImageReferencesDnd()
    })

    act(() => {
      result.current.handleDragOver(dragEvent(first.id, third.id))
    })

    expect(result.current.order).toEqual([second.id, third.id, first.id])
    expect(useImageGeneratorStore.getState().references).toEqual(IDS)
  })

  it('commits the preview order on drop', () => {
    const { result } = renderHook(() => {
      return useImageReferencesDnd()
    })

    act(() => {
      result.current.handleDragEnd(dragEvent(first.id, third.id))
    })

    expect(useImageGeneratorStore.getState().references).toEqual([second.id, third.id, first.id])
  })
})
