'use client'

import { useState } from 'react'
import {
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import { useImageGeneratorStore } from './store'

/** Drag state and reorder handler for the image reference chips. */
export function useImageReferencesDnd() {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveId(String(event.active.id))
  }

  const handleDragCancel = (): void => {
    setActiveId(null)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    useImageGeneratorStore.getState().moveReference(String(active.id), String(over.id))
  }

  return { activeId, sensors, handleDragStart, handleDragEnd, handleDragCancel }
}
