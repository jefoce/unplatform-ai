'use client'

import { type MouseEvent, useCallback } from 'react'
import { isNil } from 'lodash-es'

import { getPreset } from '@/core/presets'
import type { UploadItem } from '@/core/types'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/store'
import { useDropUpload } from '@/features/media-picker/use-drop-upload'
import { openPreview } from '@/features/preview/preview-store'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { FrameSlotCard } from './FrameSlotCard'
import { useGeneratorStore } from './store'

interface FrameSlotProps {
  slot: 'start' | 'end'
  disabled?: boolean
  disabledReason?: string
}

interface FrameStateParams {
  hasFrame: boolean
  upload?: UploadItem
}

interface SlotTooltipParams {
  isBroken: boolean
  isDisabled: boolean
  disabledReason?: string
}

const TARGETS = { start: 'frame-start', end: 'frame-end' } as const
const LABELS = { start: 'Start frame', end: 'End frame' } as const

function frameState(params: FrameStateParams): { isBroken: boolean; isPreviewable: boolean } {
  const { hasFrame, upload } = params

  if (!hasFrame) return { isBroken: false, isPreviewable: false }

  if (isNil(upload) || upload.missing === true) return { isBroken: true, isPreviewable: false }

  return { isBroken: false, isPreviewable: true }
}

function slotTooltip(params: SlotTooltipParams): string | undefined {
  const { isBroken, isDisabled, disabledReason } = params

  if (isDisabled) return disabledReason

  return isBroken ? 'File missing' : undefined
}

/** One frame drop slot with preview, replace and remove actions. */
export function FrameSlot(props: FrameSlotProps) {
  const { slot, disabled: isDisabled = false, disabledReason } = props
  const frameId = useGeneratorStore((state) => state.frames[slot])
  const upload = useGeneratorStore((state) =>
    isNil(frameId) || frameId === '' ? undefined : state.uploadsById[frameId],
  )
  const setFrame = useGeneratorStore((state) => state.setFrame)
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const extensions = extensionsFromLimits(preset.referenceLimits)
  const handleUploaded = (items: UploadItem[]): void => {
    const [item] = items

    if (!isNil(item)) setFrame(slot, item)
  }
  const { dragging: isDragging, dropProps } = useDropUpload({
    id: `frame-${slot}`,
    enabled: !isDisabled,
    kinds: ['image'],
    extensions,
    onUploaded: handleUploaded,
  })
  const hasFrame = Boolean(frameId)
  const { isBroken, isPreviewable } = frameState({ hasFrame, upload })

  const handlePick = (): void =>
    openMediaPicker({
      target: TARGETS[slot],
      kinds: ['image'],
      max: 1,
      extensions,
      onPick: handleUploaded,
    })

  const handleRemove = useCallback((): void => setFrame(slot, null), [setFrame, slot])

  const handlePreview = (): void => {
    if (!upload) return

    openPreview({
      items: [upload],
      index: 0,
      actions: {
        replace: handlePick,
        remove: handleRemove,
      },
    })
  }

  const handleSlotPress = isPreviewable ? handlePreview : handlePick
  const handleRemoveClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.stopPropagation()
      handleRemove()
    },
    [handleRemove],
  )

  return (
    <Tooltip content={slotTooltip({ isBroken, isDisabled, disabledReason })}>
      <span className={cn('block w-full', isDragging && 'ring-1 ring-lime/40')} {...dropProps}>
        <FrameSlotCard
          label={LABELS[slot]}
          upload={upload}
          hasFrame={hasFrame}
          isBroken={isBroken}
          isPreviewable={isPreviewable}
          isDisabled={isDisabled}
          onPress={handleSlotPress}
          onRemove={handleRemoveClick}
        />
      </span>
    </Tooltip>
  )
}
