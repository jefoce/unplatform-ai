'use client'

import { isEmpty } from 'lodash-es'

import type { KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { RefSlot } from '@/core/prompt-tokens'
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
  isLoading: boolean
  canChooseFiles: boolean
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  actions: PreviewActions
  slots?: Map<string, RefSlot>
  isSelected: (item: UploadItem) => boolean
  disabledReason: (item: UploadItem) => string | undefined
  onUploaded: (items: UploadItem[]) => void
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
  onSelect: (item: UploadItem) => void
  onDelete: (item: UploadItem) => void
}

const SKELETON = [0, 1, 2, 3]

/** Uploads grid with the upload tile first. */
export function UploadsGrid(props: UploadsGridProps) {
  const { items, uploading, isLoading, canChooseFiles, kinds, max, extensions, actions } = props
  const isEmptyList = isEmpty(items)
  const isInitialLoading = isLoading && isEmptyList

  return (
    <div className="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto overscroll-contain">
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
        {items.map((item, previewIndex) => {
          return (
            <MediaRow
              key={item.id}
              item={item}
              items={items}
              previewIndex={previewIndex}
              actions={actions}
              slotNumber={props.slots?.get(item.id)?.n}
              isSelected={props.isSelected(item)}
              disabledReason={props.disabledReason(item)}
              onSelect={props.onSelect}
              onDelete={props.onDelete}
            />
          )
        })}
        {isInitialLoading &&
          SKELETON.map((key) => {
            return <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
          })}
        {!isLoading && isEmptyList && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">No uploads yet</p>
        )}
      </div>
    </div>
  )
}
