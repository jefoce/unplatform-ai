'use client'

import { useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { getPreset } from '@/core/presets'
import { registerPickerAnchor } from '@/features/media-picker/picker/anchors'

import { useGeneratorStore } from '../store/store'
import { FrameSlot } from './FrameSlot'

/** Start/end slot grid for the Frames tab. */
export function FrameSlots() {
  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const startId = useGeneratorStore((state) => {
    return state.frames.start
  })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current

    if (isNil(element)) {
      return
    }

    return registerPickerAnchor('frames', element)
  }, [preset.frames.start])

  if (!preset.frames.start) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="rounded-panel border border-line p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
    >
      <div className="grid grid-cols-2 gap-1">
        <FrameSlot slot="start" />
        {preset.frames.end && (
          <FrameSlot
            slot="end"
            disabled={!isNonEmptyString(startId)}
            disabledReason="Add start frame first"
          />
        )}
      </div>
    </div>
  )
}
