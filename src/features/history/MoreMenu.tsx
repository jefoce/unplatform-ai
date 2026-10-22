'use client'

import { useCallback, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { getPreset } from '@/core/presets'
import type { GenerationRecord } from '@/core/types'
import { cn } from '@/lib/cn'

import { DeleteConfirm } from './DeleteConfirm'
import { MoreMenuContent } from './MoreMenuContent'
import {
  addReference,
  cancelInGrace,
  captureFrame,
  copyPrompt,
  copySeed,
  revealRecord,
} from './record-menu-actions'

const ROUND_BUTTON_CLASSES =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

interface MoreMenuProps {
  record: GenerationRecord
  onDeleted?: () => void
  className?: string
  variant?: 'overlay' | 'panel'
}

/** Record actions: frame capture, reference copy, clipboard, reveal, delete. */
export function MoreMenu(props: MoreMenuProps) {
  const { record, onDeleted: handleDeleted, className, variant = 'overlay' } = props
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const handleConfirmOpenChange = setIsConfirmOpen
  const isCompleted = record.status === 'completed'
  const hasFullVideoRefs = getPreset(record.preset.id).references.video === 0

  const handleCaptureLast = useCallback(() => void captureFrame(record, 'last'), [record])
  const handleCaptureFirst = useCallback(() => void captureFrame(record, 'first'), [record])
  const handleAddReference = useCallback(() => void addReference(record), [record])
  const handleCopyPrompt = useCallback(() => void copyPrompt(record), [record])
  const handleCopySeed = useCallback(() => void copySeed(record), [record])
  const handleReveal = useCallback(() => void revealRecord(record), [record])
  const handleRemove = useCallback(() => {
    if (!cancelInGrace(record)) setIsConfirmOpen(true)
  }, [record])

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            data-card-menu
            className={cn(
              variant === 'panel'
                ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-2 transition hover:bg-hover'
                : ROUND_BUTTON_CLASSES,
              className,
            )}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </DropdownMenuPrimitive.Trigger>
        <MoreMenuContent
          isCompleted={isCompleted}
          hasFullVideoRefs={hasFullVideoRefs}
          onCaptureLast={handleCaptureLast}
          onCaptureFirst={handleCaptureFirst}
          onAddReference={handleAddReference}
          onCopyPrompt={handleCopyPrompt}
          onCopySeed={handleCopySeed}
          onReveal={handleReveal}
          onRemove={handleRemove}
        />
      </DropdownMenuPrimitive.Root>
      <DeleteConfirm
        record={record}
        open={isConfirmOpen}
        onOpenChange={handleConfirmOpenChange}
        onDeleted={handleDeleted}
      />
    </>
  )
}
