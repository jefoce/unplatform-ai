'use client'

import { closestCenter, DndContext } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'

import type { KindExtensions } from '@/core/media-kinds'
import type { ModelPreset } from '@/core/presets/types'

import { AddReferenceTile } from './AddReferenceTile'
import { labelFor, noteFor } from './reference-notes'
import { ReferenceCounters } from './ReferenceCounters'
import { ReferenceDragOverlay } from './ReferenceDragOverlay'
import { ReferenceItem } from './ReferenceItem'
import { useReferencesGrid } from './use-references-grid'

interface ReferencesGridProps {
  preset: ModelPreset
  extensions?: KindExtensions
  max: number
  onPick: () => void
}

/** Sortable reference grid with counters and drag reorder. */
export function ReferencesGrid(props: ReferencesGridProps) {
  const { preset, extensions, max } = props

  const grid = useReferencesGrid(preset)

  return (
    <DndContext
      sensors={grid.sensors}
      collisionDetection={closestCenter}
      onDragStart={grid.handleDragStart}
      onDragOver={grid.handleDragOver}
      onDragEnd={grid.handleDragEnd}
      onDragCancel={grid.handleDragCancel}
    >
      <div className="max-h-50 min-h-34.5 overflow-y-auto rounded-2xl border border-transparent bg-surface p-4">
        <ReferenceCounters counts={grid.counts} preset={preset} plan={grid.plan} />
        <div className="grid grid-cols-4 justify-center gap-2">
          {max > 0 && <AddReferenceTile onPick={props.onPick} />}
          <SortableContext items={grid.references} strategy={rectSortingStrategy}>
            {grid.references.map((id) => {
              return (
                <ReferenceItem
                  key={id}
                  id={id}
                  upload={grid.uploadsById[id]}
                  label={labelFor(grid.slots, id)}
                  note={noteFor({ id, planned: grid.planned })}
                  previewUploads={grid.previewUploads}
                  slots={grid.slots}
                  extensions={extensions}
                  onSelectSlot={grid.insertMention}
                  onReplace={grid.replaceReference}
                  onRemove={grid.removeReference}
                />
              )
            })}
          </SortableContext>
        </div>
      </div>
      <ReferenceDragOverlay
        activeId={grid.activeId}
        uploadsById={grid.uploadsById}
        planned={grid.planned}
        slots={grid.slots}
        previewUploads={grid.previewUploads}
        extensions={extensions}
        onSelectSlot={grid.insertMention}
        onReplace={grid.replaceReference}
        onRemove={grid.removeReference}
      />
    </DndContext>
  )
}
