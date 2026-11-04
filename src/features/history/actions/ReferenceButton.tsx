'use client'

import { ImagePlus } from 'lucide-react'

import { focusGenerator } from '@/features/generator/focus-generator'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { type HistoryItem, isVideoItem } from '@/lib/feed/output-items'
import { useAsyncAction } from '@/lib/use-async-action'

import { referenceImageItem } from './image-actions'
import { addReference } from './record-menu-actions'

const BUTTON_CLASSES =
  'inline-flex h-10 items-center gap-2 rounded-full bg-black/60 px-4 text-sm font-semibold text-fg backdrop-blur-sm linux:bg-solid-overlay transition hover:bg-black/80 disabled:opacity-50'

interface ReferenceButtonProps {
  item: HistoryItem
}

/** Adds a saved output or finished video to the draft for its workspace. */
export function ReferenceButton(props: ReferenceButtonProps) {
  const { item } = props

  const apply = useAsyncAction(async () => {
    let isApplied = false

    if (isVideoItem(item)) {
      isApplied = await addReference(item.source)
    } else {
      isApplied = await referenceImageItem(item)
    }

    if (!isApplied) {
      return
    }

    useHistoryViewerStore.getState().close()
    focusGenerator()
  })

  return (
    <button type="button" disabled={apply.isRunning} onClick={apply.run} className={BUTTON_CLASSES}>
      <ImagePlus size={16} aria-hidden />
      Reference
    </button>
  )
}
