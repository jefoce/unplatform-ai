'use client'

import { useCallback, useEffect, useState } from 'react'
import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import type { GenerationRecord } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { confirmDelete, deleteSelected, downloadSelected, likeSelected } from './selection-actions'
import { useSelectionStore } from './selection-store'
import { SelectionToolbar } from './SelectionToolbar'

interface SelectionBarProps {
  records: GenerationRecord[]
}

/** Selection state and batch handlers for the floating toolbar. */
export function SelectionBar(props: SelectionBarProps) {
  const { records } = props
  const ids = useSelectionStore((state) => state.ids)
  const handleClear = useSelectionStore((state) => state.clear)
  const [busy, setBusy] = useState<'like' | 'delete' | 'download' | null>(null)

  const selected = records.filter((record) => ids.has(record.id))
  const isActive = ids.size > 0

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return

      if (document.querySelector('[role="dialog"],[role="menu"]')) return

      handleClear()
    }

    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [handleClear])

  const byId = new Map(records.map((record) => [record.id, record]))
  const stack = [...ids].slice(-3).reverse()
  const isAllCompleted =
    selected.length > 0 && selected.every((record) => record.status === 'completed')
  const isAllLiked = selected.every((record) => record.favorite)
  const isBusy = !isNil(busy)

  const handleDownload = useCallback(async () => {
    if (!isAllCompleted) return

    setBusy('download')

    try {
      await downloadSelected(selected)
    } finally {
      setBusy(null)
    }
  }, [isAllCompleted, selected])

  const handleLike = useCallback(async () => {
    setBusy('like')

    try {
      await likeSelected(selected, !isAllLiked)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }, [isAllLiked, selected])

  const handleDelete = useCallback(async () => {
    const isConfirmed = await confirmDelete(selected)

    if (!isConfirmed) return

    setBusy('delete')

    try {
      await deleteSelected(selected)
      handleClear()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }, [selected, handleClear])

  return (
    <SelectionToolbar
      isActive={isActive}
      count={ids.size}
      stack={stack}
      byId={byId}
      isAllCompleted={isAllCompleted}
      isAllLiked={isAllLiked}
      isBusy={isBusy}
      onDownload={handleDownload}
      onLike={handleLike}
      onDelete={handleDelete}
      onClear={handleClear}
    />
  )
}
