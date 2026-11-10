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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { isEqual, isNil } from 'lodash-es'

import type { PixelSize } from '@/core/media/geometry'

import { useGeneratorStore } from '../store/store'
import { dragStartSize, moveOrder } from './drag-order'

/** Sortable drag state and handlers for the references grid. */
export function useReferencesDnd(references: string[]) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<PixelSize | null>(null)
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const order = previewOrder ?? references

  const handleDragStart = useCallback((event: DragStartEvent): void => {
    setActiveId(String(event.active.id))
    setActiveSize(dragStartSize(event))
    setPreviewOrder(null)
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

      setPreviewOrder((current) => {
        const orderNow = current ?? references
        const next = moveOrder({ orderNow, activeId: String(active.id), overId: over.id })

        if (isEqual(next, orderNow)) {
          return current
        }

        return next
      })
    },
    [references],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event
      const orderNow = previewOrder ?? references

      setPreviewOrder(null)
      setActiveId(null)
      setActiveSize(null)

      const final = moveOrder({ orderNow, activeId: String(active.id), overId: over?.id })

      if (!isEqual(final, references)) {
        useGeneratorStore.setState({ references: final })
      }
    },
    [previewOrder, references],
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
