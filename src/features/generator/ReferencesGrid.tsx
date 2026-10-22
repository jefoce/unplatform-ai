'use client'

import { closestCenter, DndContext } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { keyBy } from 'lodash-es'

import type { ModelPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { PickerExtensions } from '@/features/media-picker/store'
import { UploadProgressTile } from '@/features/media-picker/UploadProgressTile'
import type { DropProps } from '@/features/media-picker/use-drop-upload'
import type { UploadQueue } from '@/features/media-picker/use-upload-queue'
import { cn } from '@/lib/cn'

import { AddReferenceTile } from './AddReferenceTile'
import { labelFor, noteFor, referenceUploads } from './reference-notes'
import { ReferenceCounters } from './ReferenceCounters'
import { ReferenceDragOverlay } from './ReferenceDragOverlay'
import { ReferenceItem } from './ReferenceItem'
import { useGeneratorStore } from './store'
import { useImagePlan } from './use-image-plan'
import { useReferencesDnd } from './use-references-dnd'

interface ReferencesGridProps {
  preset: ModelPreset
  extensions?: PickerExtensions
  max: number
  queue: UploadQueue
  dropProps: DropProps
  isDragging: boolean
  onPick: () => void
}

/** Sortable reference grid with counters, drag reorder and upload progress. */
export function ReferencesGrid(props: ReferencesGridProps) {
  const { preset, extensions, max, queue, dropProps, isDragging, onPick: handlePick } = props
  const references = useGeneratorStore((state) => state.references)
  const uploadsById = useGeneratorStore((state) => state.uploadsById)
  const handleSelectSlot = useGeneratorStore((state) => state.insertMention)
  const handleReplace = useGeneratorStore((state) => state.replaceReference)
  const handleRemove = useGeneratorStore((state) => state.removeReference)
  const {
    activeId,
    order,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useReferencesDnd(references)
  const { counts, slots } = referenceSlots(order, (id) => uploadsById[id]?.kind)
  const plan = useImagePlan(
    preset.id,
    references.filter((id) => uploadsById[id]?.kind === 'image'),
  )
  const planned = keyBy(plan?.images ?? [], 'id')
  const previewUploads = referenceUploads(references, uploadsById)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          'max-h-50 min-h-34.5 overflow-y-auto rounded-2xl border border-transparent bg-surface p-4',
          isDragging && 'ring-1 ring-lime/40',
        )}
        {...dropProps}
      >
        <ReferenceCounters counts={counts} preset={preset} plan={plan} />
        <div className="grid grid-cols-4 justify-center gap-2">
          {max > 0 && <AddReferenceTile onPick={handlePick} />}
          <SortableContext items={references} strategy={rectSortingStrategy}>
            {references.map((id) => (
              <ReferenceItem
                key={id}
                id={id}
                upload={uploadsById[id]}
                label={labelFor(slots, id)}
                note={noteFor({ id, planned })}
                previewUploads={previewUploads}
                slots={slots}
                extensions={extensions}
                onSelectSlot={handleSelectSlot}
                onReplace={handleReplace}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
          {queue.items.map((item) => (
            <UploadProgressTile key={item.id} item={item} />
          ))}
        </div>
      </div>
      <ReferenceDragOverlay
        activeId={activeId}
        uploadsById={uploadsById}
        planned={planned}
        slots={slots}
        previewUploads={previewUploads}
        extensions={extensions}
        onSelectSlot={handleSelectSlot}
        onReplace={handleReplace}
        onRemove={handleRemove}
      />
    </DndContext>
  )
}
