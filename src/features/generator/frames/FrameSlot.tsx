'use client'

import { type MouseEvent } from 'react'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { KindExtensions } from '@/core/media-kinds'
import { getPreset } from '@/core/presets'
import type { UploadItem } from '@/core/schemas/upload-item'
import { pickerAnchor } from '@/features/media-picker/picker/anchors'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/picker/store'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'
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

const LABELS = { start: 'Start frame', end: 'End frame' } as const
const FRAME_SLOTS = ['start', 'end'] as const

type FrameSlotName = (typeof FRAME_SLOTS)[number]

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

interface OpenFramePickerParams {
  openerKey: string
  extensions?: KindExtensions
  onPick: (item: UploadItem) => void
}

/** Opens the image picker for one frame slot. */
function openFramePicker(params: OpenFramePickerParams): void {
  const { openerKey, extensions, onPick } = params

  openMediaPicker({
    openerKey,
    kinds: ['image'],
    extensions,
    anchor: pickerAnchor('frames'),
    mode: { kind: 'pick', onPick },
  })
}

/** Frame uploads in slot order, without missing files. */
function frameChain(): UploadItem[] {
  const { frames, uploadsById } = useGeneratorStore.getState()

  return FRAME_SLOTS.flatMap((each) => {
    const id = frames[each]

    if (!isNonEmptyString(id)) {
      return []
    }

    const item = uploadsById[id]

    if (isNil(item) || item.missing === true) {
      return []
    }

    return [item]
  })
}

/** Slot holding the upload, if it is still attached. */
function slotForUpload(upload: UploadItem): FrameSlotName | undefined {
  const { frames } = useGeneratorStore.getState()

  return FRAME_SLOTS.find((each) => {
    return frames[each] === upload.id
  })
}

interface ReplaceFrameParams {
  current: UploadItem
  extensions?: KindExtensions
  setFrame: (slot: FrameSlotName, upload: UploadItem | null) => void
}

/** Opens the picker for the slot holding the shown frame. */
function replaceFrame(params: ReplaceFrameParams): void {
  const { current, extensions, setFrame } = params
  const target = slotForUpload(current)

  if (isNil(target)) {
    return
  }

  const handlePick = (next: UploadItem): void => {
    setFrame(target, next)
  }

  openFramePicker({ openerKey: `frame:${target}`, extensions, onPick: handlePick })
}

interface RemoveFrameParams {
  current: UploadItem
  setFrame: (slot: FrameSlotName, upload: UploadItem | null) => void
}

/** Clears the slot holding the shown frame. */
function removeFrame(params: RemoveFrameParams): void {
  const { current, setFrame } = params
  const target = slotForUpload(current)

  if (isNil(target)) {
    return
  }

  setFrame(target, null)
}

interface OpenFramePreviewParams {
  upload: UploadItem
  actions: PreviewActions
}

/** Opens the frame chain at the shown upload. */
function openFramePreview(params: OpenFramePreviewParams): void {
  const { upload, actions } = params
  const items = frameChain()

  const index = items.findIndex((item) => {
    return item.id === upload.id
  })

  if (index < 0) {
    return
  }

  openPreview({ items, index, actions })
}

/** One frame slot with preview, replace and remove actions. */
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

  const hasFrame = Boolean(frameId)
  const { isBroken, isPreviewable } = frameState({ hasFrame, upload })

  const handlePickFrame = (item: UploadItem): void => {
    setFrame(slot, item)
  }

  const handlePick = (): void => {
    openFramePicker({ openerKey: `frame:${slot}`, extensions, onPick: handlePickFrame })
  }

  const handleRemove = (): void => {
    setFrame(slot, null)
  }

  const handleReplace = (current: UploadItem): void => {
    replaceFrame({ current, extensions, setFrame })
  }

  const handleRemoveAction = (current: UploadItem): void => {
    removeFrame({ current, setFrame })
  }

  const handlePreview = (): void => {
    if (isNil(upload)) {
      return
    }

    openFramePreview({
      upload,
      actions: { replace: handleReplace, remove: handleRemoveAction },
    })
  }

  const handleSlotPress = isPreviewable ? handlePreview : handlePick

  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    handleRemove()
  }

  return (
    <Tooltip content={slotTooltip({ isBroken, isDisabled, disabledReason })}>
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
    </Tooltip>
  )
}
