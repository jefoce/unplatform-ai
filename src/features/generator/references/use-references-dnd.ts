'use client'

import { useCallback, useState } from 'react'
import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { PixelSize } from '@/core/media/geometry'

import { useGeneratorStore } from '../store/store'

interface MoveRangeParams {
  references: string[]
  uploadsById: UploadsById
  activeId: string
  overId: string
}

/** Flat indexes for a same-kind move, or null when the drop does not move. */
function moveRange(params: MoveRangeParams): [number, number] | null {
  const { references, uploadsById, activeId, overId } = params

  if (uploadsById[activeId]?.kind !== uploadsById[overId]?.kind) {
    return null
  }

  const from = references.indexOf(activeId)
  const to = references.indexOf(overId)

  if (from < 0 || to < 0 || from === to) {
    return null
  }

  return [from, to]
}

/** Size of the tile at drag start, so the overlay keeps the real box. */
function dragStartSize(event: DragStartEvent): PixelSize | null {
  const initial = event.active.rect.current.initial

  if (!isNil(initial)) {
    return { width: initial.width, height: initial.height }
  }

  // dnd-kit fills the active rect after the start event, so read the node now.
  const id = String(event.active.id)

  const node = Array.from(document.querySelectorAll<HTMLElement>('[data-reference-id]')).find(
    (candidate) => {
      return candidate.dataset.referenceId === id
    },
  )

  if (isNil(node)) {
    return null
  }

  const rect = node.getBoundingClientRect()

  return { width: rect.width, height: rect.height }
}

/** Sortable drag state and handlers for the references grid. */
export function useReferencesDnd(references: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<PixelSize | null>(null)
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null)

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const order = previewOrder ?? references

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    setActiveId(String(event.active.id))
    setActiveSize(dragStartSize(event))
  }, [])

  const handleDragCancel = useCallback((): void => {
    setActiveId(null)
    setActiveSize(null)
    setPreviewOrder(null)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent): void => {
      const { active, over } = event

      if (isNil(over) || active.id === over.id) {
        return
      }

      const range = moveRange({
        references,
        uploadsById,
        activeId: String(active.id),
        overId: String(over.id),
      })

      if (isNil(range)) {
        return
      }

      setPreviewOrder(arrayMove(references, range[0], range[1]))
    },
    [references, uploadsById],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      setActiveId(null)
      setActiveSize(null)
      setPreviewOrder(null)
      const { active, over } = event

      if (isNil(over) || active.id === over.id) {
        return
      }

      const range = moveRange({
        references,
        uploadsById,
        activeId: String(active.id),
        overId: String(over.id),
      })

      if (isNil(range)) {
        return
      }

      useGeneratorStore.setState({ references: arrayMove(references, range[0], range[1]) })
    },
    [references, uploadsById],
  )

  return {
    activeId,
    activeSize,
    order,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
