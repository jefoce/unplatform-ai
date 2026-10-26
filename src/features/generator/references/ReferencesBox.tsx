'use client'

import { isEmpty, sumBy } from 'lodash-es'
import { toast } from 'sonner'

import { MEDIA_KINDS } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/picker/store'
import { UploadProgressTile } from '@/features/media-picker/uploads/UploadProgressTile'
import { useDropUpload } from '@/features/media-picker/uploads/use-drop-upload'
import { useUploadQueue } from '@/features/media-picker/uploads/use-upload-queue'

import { useGeneratorStore } from '../store/store'
import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferencesGrid } from './ReferencesGrid'

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox() {
  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const extensions = extensionsFromLimits(preset.referenceLimits)

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const addReferences = useGeneratorStore((state) => {
    return state.addReferences
  })

  const queue = useUploadQueue(addReferences, (message) => {
    return toast.error(message)
  })

  const { counts } = referenceSlots(references, (id) => {
    return uploadsById[id]?.kind
  })

  const kinds = MEDIA_KINDS.filter((kind) => {
    return counts[kind] < preset.references[kind]
  })

  const max = sumBy(kinds, (kind) => {
    return preset.references[kind] - counts[kind]
  })

  const handlePick = (): void => {
    if (isEmpty(kinds)) {
      return
    }

    openMediaPicker({ target: 'references', kinds, max, extensions, onPick: addReferences })
  }

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
          {queue.items.map((item) => {
            return <UploadProgressTile key={item.id} item={item} />
          })}
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
