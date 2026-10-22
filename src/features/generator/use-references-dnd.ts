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

import { useGeneratorStore } from './store'

/** Sortable drag state and handlers for the references grid. */
export function useReferencesDnd(references: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const order = previewOrder ?? references
  const indexes = useCallback(
    (a: string, b: string): [number, number] => [references.indexOf(a), references.indexOf(b)],
    [references],
  )
  const handleDragStart = useCallback((event: DragStartEvent): void => {
    setActiveId(String(event.active.id))
  }, [])
  const handleDragCancel = useCallback((): void => {
    setActiveId(null)
    setPreviewOrder(null)
  }, [])
  const handleDragOver = useCallback(
    (event: DragOverEvent): void => {
      const { active, over } = event

      if (!over || active.id === over.id) return

      const [from, to] = indexes(String(active.id), String(over.id))

      if (from < 0 || to < 0 || from === to) return

      setPreviewOrder(arrayMove(references, from, to))
    },
    [indexes, references],
  )
  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      setActiveId(null)
      setPreviewOrder(null)
      const { active, over } = event

      if (!over || active.id === over.id) return

      const [from, to] = indexes(String(active.id), String(over.id))

      if (from < 0 || to < 0 || from === to) return

      useGeneratorStore.setState({ references: arrayMove(references, from, to) })
    },
    [indexes, references],
  )

  return {
    activeId,
    order,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
