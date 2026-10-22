'use client'

import { useCallback } from 'react'
import { isEmpty, sumBy } from 'lodash-es'
import { toast } from 'sonner'

import { MEDIA_KINDS } from '@/core/media-kinds'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/store'
import { UploadProgressTile } from '@/features/media-picker/UploadProgressTile'
import { useDropUpload } from '@/features/media-picker/use-drop-upload'
import { useUploadQueue } from '@/features/media-picker/use-upload-queue'

import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferencesGrid } from './ReferencesGrid'
import { useGeneratorStore } from './store'

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox() {
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const extensions = extensionsFromLimits(preset.referenceLimits)
  const references = useGeneratorStore((state) => state.references)
  const uploadsById = useGeneratorStore((state) => state.uploadsById)
  const addReferences = useGeneratorStore((state) => state.addReferences)
  const queue = useUploadQueue(addReferences, (message) => toast.error(message))
  const { counts } = referenceSlots(references, (id) => uploadsById[id]?.kind)
  const kinds = MEDIA_KINDS.filter((kind) => counts[kind] < preset.references[kind])
  const max = sumBy(kinds, (kind) => preset.references[kind] - counts[kind])
  const handlePick = useCallback((): void => {
    if (isEmpty(kinds)) return

    openMediaPicker({ target: 'references', kinds, max, extensions, onPick: addReferences })
  }, [kinds, max, extensions, addReferences])
  const { dragging: isDragging, dropProps } = useDropUpload({
    id: 'references',
    enabled: true,
    kinds,
    extensions,
    onUploaded: addReferences,
    onFiles: queue.enqueue,
  })

  if (references.length > 0) {
    return (
      <ReferencesGrid
        preset={preset}
        extensions={extensions}
        max={max}
        queue={queue}
        dropProps={dropProps}
        isDragging={isDragging}
        onPick={handlePick}
      />
    )
  }

  return (
    <>
      {queue.items.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {queue.items.map((item) => (
            <UploadProgressTile key={item.id} item={item} />
          ))}
        </div>
      )}
      <ReferencesEmpty
        preset={preset}
        dropProps={dropProps}
        dragging={isDragging}
        onPick={handlePick}
      />
    </>
  )
}
