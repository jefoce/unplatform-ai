'use client'

import { type MouseEvent } from 'react'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { getPreset } from '@/core/presets'
import type { UploadItem } from '@/core/schemas/upload-item'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/picker/store'
import { useDropUpload } from '@/features/media-picker/uploads/use-drop-upload'
import { openPreview } from '@/features/preview/preview-store'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { useGeneratorStore } from '../store/store'
import { FrameSlotCard } from './FrameSlotCard'

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

interface FrameState {
  isBroken: boolean
  isPreviewable: boolean
}

function frameState(params: FrameStateParams): FrameState {
  const { hasFrame, upload } = params

  if (!hasFrame) {
    return { isBroken: false, isPreviewable: false }
  }

  if (isNil(upload) || upload.missing === true) {
    return { isBroken: true, isPreviewable: false }
  }

  return { isBroken: false, isPreviewable: true }
}

function slotTooltip(params: SlotTooltipParams): string | undefined {
  const { isBroken, isDisabled, disabledReason } = params

  if (isDisabled) {
    return disabledReason
  }

  if (isBroken) {
    return 'File missing'
  }

  return undefined
}

interface PreviewUploadParams {
  upload?: UploadItem
  replace: () => void
  remove: () => void
}

function previewUpload(params: PreviewUploadParams): void {
  const { upload, replace, remove } = params

  if (!upload) {
    return
  }

  openPreview({ items: [upload], index: 0, actions: { replace, remove } })
}

/** One frame drop slot with preview, replace and remove actions. */
export function FrameSlot(props: FrameSlotProps) {
  const { slot, disabled: isDisabled = false, disabledReason } = props

  const frameId = useGeneratorStore((state) => {
    return state.frames[slot]
  })

  const upload = useGeneratorStore((state) => {
    if (!isNonEmptyString(frameId)) {
      return
    }

    return state.uploadsById[frameId]
  })

  const setFrame = useGeneratorStore((state) => {
    return state.setFrame
  })

  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const extensions = extensionsFromLimits(preset.referenceLimits)

  const handleUploaded = (items: UploadItem[]): void => {
    const [item] = items

    if (!isNil(item)) {
      setFrame(slot, item)
    }
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

  const handlePick = (): void => {
    openMediaPicker({
      target: TARGETS[slot],
      kinds: ['image'],
      max: 1,
      extensions,
      onPick: handleUploaded,
    })
  }

  const handleRemove = (): void => {
    setFrame(slot, null)
  }

  const handlePreview = (): void => {
    previewUpload({ upload, replace: handlePick, remove: handleRemove })
  }

  const handleSlotPress = isPreviewable ? handlePreview : handlePick

  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    handleRemove()
  }

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
