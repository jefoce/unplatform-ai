'use client'

import { isEmpty } from 'lodash-es'

import type { KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { PreviewActions } from '@/features/preview/preview-store'

import { ChooseDiskTile } from '../folders/ChooseDiskTile'
import { MediaRow } from '../tiles/MediaRow'
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
  extensions?: KindExtensions
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
  } = props

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-4 content-start gap-3 p-3">
        {uploading.map((entry) => {
          return (
            <UploadingRow
              key={entry.id}
              entry={entry}
              onRetry={props.onRetry}
              onDismiss={props.onDismiss}
            />
          )
        })}
        {canChooseFiles && (
          <ChooseDiskTile
            kinds={kinds}
            max={max}
            extensions={extensions}
            onUploaded={props.onUploaded}
          />
        )}
        {!canChooseFiles && (
          <UploadTile
            kinds={kinds}
            max={max}
            extensions={extensions}
            onUploaded={props.onUploaded}
          />
        )}
        {isLoading &&
          SKELETON.map((key) => {
            return <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
          })}
        {!isLoading &&
          items.map((item, previewIndex) => {
            return (
              <MediaRow
                key={item.id}
                item={item}
                items={items}
                previewIndex={previewIndex}
                actions={actions}
                selectedIndex={selectedIds.indexOf(item.id)}
                isAtMax={isMaxReached}
                onSelect={props.onSelect}
                onDelete={props.onDelete}
              />
            )
          })}
        {!isLoading && isEmpty(items) && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">No uploads yet</p>
        )}
      </div>
    </div>
  )
}
