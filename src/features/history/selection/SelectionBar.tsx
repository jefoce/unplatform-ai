'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'

import type { RecordKind } from '@/core/feed/grid-item'
import { type HistoryItem, isImageItem } from '@/lib/feed/output-items'
import { toastError } from '@/lib/notify'

import {
  confirmDelete,
  deleteSelected,
  downloadSelected,
  isDownloadable,
} from './selection-actions'
import { useSelectionStore } from './selection-store'
import { SelectionToolbar } from './SelectionToolbar'
import { useSelectedItems } from './use-selected-items'
import { useSelectionEscape } from './use-selection-escape'

interface SelectionBarProps {
  items: HistoryItem[]
}

/** Selection state and batch handlers for the floating toolbar. */
export function SelectionBar(props: SelectionBarProps) {
  const { items } = props

  const ids = useSelectionStore((state) => {
    return state.ids
  })

  const clearSelection = useSelectionStore((state) => {
    return state.clear
  })

  const [busy, setBusy] = useState<'delete' | 'download' | null>(null)

  const { selectedItems, byId } = useSelectedItems(items, ids)
  const isActive = ids.size > 0

  useSelectionEscape(clearSelection)

  const stack = [...ids].slice(-3).reverse()
  const isImageSelection = selectedItems.length > 0 && selectedItems.every(isImageItem)
  const kind: RecordKind = isImageSelection ? 'image' : 'video'

  const completedCount = selectedItems.filter(isDownloadable).length

  const handleDownload = async () => {
    if (completedCount === 0) {
      return
    }

    setBusy('download')

    try {
      await downloadSelected(selectedItems)
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    const isConfirmed = await confirmDelete(selectedItems)

    if (!isConfirmed) {
      return
    }

    setBusy('delete')

    try {
      await deleteSelected(selectedItems)
      clearSelection()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <SelectionToolbar
      isActive={isActive}
      count={ids.size}
      kind={kind}
      stack={stack}
      byId={byId}
      completedCount={completedCount}
      isBusy={!isNil(busy)}
      onDownload={handleDownload}
      onDelete={handleDelete}
      onClear={clearSelection}
    />
  )
}
