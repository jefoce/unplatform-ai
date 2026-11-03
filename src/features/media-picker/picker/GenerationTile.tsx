'use client'

import { useId } from 'react'
import { isNil } from 'lodash-es'

import type { GridItem } from '@/core/feed/grid-item'
import { MediaTilePreview } from '@/features/media-picker/tiles/MediaTilePreview'
import {
  PICKER_TILE_CLASSES,
  SELECTED_TILE_CLASSES,
} from '@/features/media-picker/tiles/tile-classes'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import {
  closeMediaPicker,
  outputKey,
  type PickerOutputCandidate,
  type PickerOutputMode,
  useMediaPickerStore,
} from './store'

interface GenerationTileProps {
  item: GridItem
  modeKind: 'pick' | 'toggle'
  output?: PickerOutputMode
}

function candidateOf(item: GridItem): PickerOutputCandidate {
  let outputId: string | null = null

  if (item.recordKind === 'image') {
    outputId = item.id
  }

  return {
    recordId: item.recordId,
    outputId,
    recordKind: item.recordKind,
    favorite: item.favorite,
  }
}

function blockedReason(item: GridItem, output?: PickerOutputMode): string | null {
  if (!item.canSelect) {
    return 'Not ready yet'
  }

  if (isNil(output)) {
    return 'Not available here'
  }

  return output.canAdd?.(candidateOf(item)) ?? null
}

/** One generation tile in the picker, image output or video record. */
export function GenerationTile(props: GenerationTileProps) {
  const { item, modeKind, output } = props
  const reason = blockedReason(item, output)
  const isDisabled = !isNil(reason)
  const reasonId = useId()
  const describedById = isDisabled ? reasonId : undefined

  const candidate = candidateOf(item)

  const isSelected = useMediaPickerStore((state) => {
    return !isNil(state.outputUploads[outputKey(candidate)])
  })

  const handleSelect = (): void => {
    if (isNil(output)) {
      return
    }

    if (modeKind === 'toggle') {
      output.onToggle?.(candidate)

      return
    }

    output.onPick?.(candidate)
    closeMediaPicker()
  }

  return (
    <Tooltip content={reason}>
      <button
        type="button"
        onClick={handleSelect}
        disabled={isDisabled}
        aria-label={`Use ${item.modelTitle} generation`}
        aria-pressed={isSelected}
        aria-describedby={describedById}
        className={cn(
          PICKER_TILE_CLASSES,
          isDisabled && 'opacity-40',
          isSelected && SELECTED_TILE_CLASSES,
        )}
      >
        <MediaTilePreview kind={item.recordKind} thumbSrc={item.thumbSrc} />
        {isDisabled && (
          <span id={reasonId} className="sr-only">
            {reason}
          </span>
        )}
      </button>
    </Tooltip>
  )
}
