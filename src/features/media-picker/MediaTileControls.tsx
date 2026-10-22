'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'
import { Maximize2, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/lib/cn'

interface MediaTileControlsProps {
  label: string
  isPreviewable: boolean
  isBlocked: boolean
  isSelected: boolean
  isMissing: boolean
  onSelect: () => void
  onPreview?: () => void
  onDelete?: () => void
}

/** Selection, preview and delete controls for a media tile. */
export function MediaTileControls(props: MediaTileControlsProps) {
  const { label, isPreviewable, isBlocked, isSelected, isMissing, onSelect, onPreview, onDelete } =
    props
  const handleSelect = onSelect
  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onPreview?.()
    },
    [onPreview],
  )
  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onDelete?.()
    },
    [onDelete],
  )
  const handleDeleteMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation(),
    [],
  )

  return (
    <>
      <button
        type="button"
        onClick={handleSelect}
        disabled={isBlocked}
        aria-label={label}
        aria-pressed={isSelected}
        className={cn(
          'absolute inset-0 z-10 size-full rounded-lg',
          isBlocked ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      />

      {!isNil(onPreview) && !isMissing && isPreviewable && (
        <button
          type="button"
          onClick={handlePreviewClick}
          aria-label={`Preview ${label}`}
          className="absolute top-1/2 left-1/2 z-20 flex size-10 -translate-1/2 items-center justify-center rounded-full bg-black/60 text-fg opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100"
        >
          <Maximize2 size={16} aria-hidden />
        </button>
      )}

      {!isNil(onDelete) && (
        <button
          type="button"
          onClick={handleDeleteClick}
          onMouseDown={handleDeleteMouseDown}
          aria-label="Delete upload"
          className="absolute top-1 right-1 z-30 flex size-6 items-center justify-center rounded-full bg-black/40 text-fg opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-danger/80 focus-visible:opacity-100"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </>
  )
}
