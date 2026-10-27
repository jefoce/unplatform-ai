'use client'

import { ImagePlus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { focusGenerator } from '@/features/generator/focus-generator'
import { useGeneratorStore } from '@/features/generator/store/store'
import { applyMedia, type MediaTarget, mediaUse } from '@/features/generator/use-media'
import { useAsyncAction } from '@/lib/use-async-action'
import { Tooltip } from '@/ui/Tooltip'

import { closeViewers } from './close-viewers'

interface ViewerUseButtonProps {
  target: MediaTarget
}

const BUTTON_CLASSES =
  'inline-flex h-10 items-center gap-2 rounded-full bg-black/60 px-4 text-sm font-semibold text-fg backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-50'

/** Adds the current media as a reference or start frame for the active generator mode. */
export function ViewerUseButton(props: ViewerUseButtonProps) {
  const { target } = props

  const state = useGeneratorStore(
    useShallow((store) => {
      return {
        tab: store.tab,
        presetId: store.presetId,
        references: store.references,
        frames: store.frames,
        uploadsById: store.uploadsById,
      }
    }),
  )

  const media = mediaUse(target, state)

  const apply = useAsyncAction(async () => {
    const isApplied = await applyMedia(target)

    if (!isApplied) {
      return
    }

    closeViewers()
    focusGenerator()
  })

  return (
    <Tooltip content={media.reason}>
      <span className="inline-flex">
        <button
          type="button"
          disabled={media.isDisabled || apply.isRunning}
          onClick={apply.run}
          className={BUTTON_CLASSES}
        >
          <ImagePlus size={16} aria-hidden />
          {media.label}
        </button>
      </span>
    </Tooltip>
  )
}
