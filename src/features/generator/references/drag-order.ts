import type { DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { isNil } from 'lodash-es'

import type { PixelSize } from '@/core/media/geometry'

/** Size of the tile at drag start, so an overlay keeps the real box. */
export function dragStartSize(event: DragStartEvent): PixelSize | null {
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

interface MoveOrderParams {
  orderNow: string[]
  activeId: string
  overId: string | number | undefined
}

/** Order after moving active onto over, unchanged when the move does not apply. */
export function moveOrder(params: MoveOrderParams): string[] {
  const { orderNow, activeId, overId } = params

  if (isNil(overId)) {
    return orderNow
  }

  const from = orderNow.indexOf(activeId)
  const to = orderNow.indexOf(String(overId))

  if (from < 0 || to < 0 || from === to) {
    return orderNow
  }

  return arrayMove(orderNow, from, to)
}
