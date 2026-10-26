'use client'

import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { getPreset } from '@/core/presets'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cn } from '@/lib/cn'
import { useBoolean } from '@/lib/use-boolean'

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
  const { record, className, variant = 'overlay' } = props
  const confirmDialog = useBoolean()
  const isCompleted = record.status === 'completed'
  const hasFullVideoRefs = getPreset(record.preset.id).references.video === 0

  const handleCaptureLast = () => {
    return void captureFrame(record, 'last')
  }

  const handleCaptureFirst = () => {
    return void captureFrame(record, 'first')
  }

  const handleAddReference = () => {
    return void addReference(record)
  }

  const handleCopyPrompt = () => {
    return void copyPrompt(record)
  }

  const handleCopySeed = () => {
    return void copySeed(record)
  }

  const handleReveal = () => {
    return void revealRecord(record)
  }

  const handleConfirmOpenChange = (isOpen: boolean): void => {
    confirmDialog.set(isOpen)
  }

  const handleRemove = () => {
    if (!cancelInGrace(record)) {
      confirmDialog.on()
    }
  }

  const triggerClass =
    variant === 'panel'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-2 transition hover:bg-hover'
      : ROUND_BUTTON_CLASSES

  return (
    <>
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            data-card-menu
            className={cn(triggerClass, className)}
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
        open={confirmDialog.value}
        onOpenChange={handleConfirmOpenChange}
        onDeleted={props.onDeleted}
      />
    </>
  )
}
