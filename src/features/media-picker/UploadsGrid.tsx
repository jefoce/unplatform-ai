'use client'

import { isEmpty } from 'lodash-es'

import type { MediaKind, UploadItem } from '@/core/types'
import type { PreviewActions } from '@/features/preview/preview-store'

import { ChooseDiskTile } from './ChooseDiskTile'
import { MediaRow } from './MediaRow'
import type { PickerExtensions } from './store'
import { UploadingRow } from './UploadingRow'
import type { UploadProgressItem } from './UploadProgressTile'
import { UploadTile } from './UploadTile'

interface UploadsGridProps {
  items: UploadItem[]
  uploading: UploadProgressItem[]
  selectedIds: string[]
  isMaxReached: boolean
  isLoading: boolean
  canChooseFiles: boolean
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  actions: PreviewActions
  onUploaded: (items: UploadItem[]) => void
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
  onSelect: (item: UploadItem) => void
  onDelete: (item: UploadItem) => void
}

const SKELETON = [0, 1, 2, 3]

/** Uploads grid with the upload tile first. */
export function UploadsGrid(props: UploadsGridProps) {
  const {
    items,
    uploading,
    selectedIds,
    isMaxReached,
    isLoading,
    canChooseFiles,
    kinds,
    max,
    extensions,
    actions,
    onUploaded,
    onRetry,
    onDismiss,
    onSelect,
    onDelete,
  } = props
  const handleRetry = onRetry
  const handleDismiss = onDismiss
  const handleUploaded = onUploaded
  const handleSelect = onSelect
  const handleDelete = onDelete

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-4 content-start gap-3 p-3">
        {uploading.map((entry) => (
          <UploadingRow
            key={entry.id}
            entry={entry}
            onRetry={handleRetry}
            onDismiss={handleDismiss}
          />
        ))}
        {canChooseFiles ? (
          <ChooseDiskTile
            kinds={kinds}
            max={max}
            extensions={extensions}
            onUploaded={handleUploaded}
          />
        ) : (
          <UploadTile kinds={kinds} max={max} extensions={extensions} onUploaded={handleUploaded} />
        )}
        {isLoading
          ? SKELETON.map((key) => (
              <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))
          : items.map((item, previewIndex) => (
              <MediaRow
                key={item.id}
                item={item}
                items={items}
                previewIndex={previewIndex}
                actions={actions}
                selectedIndex={selectedIds.indexOf(item.id)}
                isAtMax={isMaxReached}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            ))}
        {!isLoading && isEmpty(items) && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">No uploads yet</p>
        )}
      </div>
    </div>
  )
}
