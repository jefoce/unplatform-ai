'use client'

import { useState } from 'react'
import { isNil } from 'lodash-es'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { toastError } from '@/lib/notify'

import { confirmDelete, deleteSelected, downloadSelected, likeSelected } from './selection-actions'
import { useSelectionStore } from './selection-store'
import { SelectionToolbar } from './SelectionToolbar'
import { useSelectionEscape } from './use-selection-escape'

interface SelectionBarProps {
  records: GenerationRecord[]
}

/** Selection state and batch handlers for the floating toolbar. */
export function SelectionBar(props: SelectionBarProps) {
  const { records } = props

  const ids = useSelectionStore((state) => {
    return state.ids
  })

  const clearSelection = useSelectionStore((state) => {
    return state.clear
  })

  const [busy, setBusy] = useState<'like' | 'delete' | 'download' | null>(null)

  const selected = records.filter((record) => {
    return ids.has(record.id)
  })

  const isActive = ids.size > 0

  useSelectionEscape(clearSelection)

  const byId = new Map(
    records.map((record) => {
      return [record.id, record]
    }),
  )

  const stack = [...ids].slice(-3).reverse()

  const isAllCompleted =
    selected.length > 0 &&
    selected.every((record) => {
      return record.status === 'completed'
    })

  const isAllLiked = selected.every((record) => {
    return record.favorite
  })

  const handleDownload = async () => {
    if (!isAllCompleted) {
      return
    }

    setBusy('download')

    try {
      await downloadSelected(selected)
    } finally {
      setBusy(null)
    }
  }

  const handleLike = async () => {
    setBusy('like')

    try {
      await likeSelected(selected, !isAllLiked)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    const isConfirmed = await confirmDelete(selected)

    if (!isConfirmed) {
      return
    }

    setBusy('delete')

    try {
      await deleteSelected(selected)
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
      stack={stack}
      byId={byId}
      isAllCompleted={isAllCompleted}
      isAllLiked={isAllLiked}
      isBusy={!isNil(busy)}
      onDownload={handleDownload}
      onLike={handleLike}
      onDelete={handleDelete}
      onClear={clearSelection}
    />
  )
}
