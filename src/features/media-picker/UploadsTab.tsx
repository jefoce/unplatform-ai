'use client'

import { isNil } from 'lodash-es'
import useSWR from 'swr'

import { extensionAllowed } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import type { PreviewActions } from '@/features/preview/preview-store'
import { getPlatform } from '@/lib/platform'

import { fetchUploads } from './api'
import { DeleteUploadDialog } from './DeleteUploadDialog'
import type { PickerExtensions } from './store'
import type { UploadProgressItem } from './UploadProgressTile'
import { UploadsGrid } from './UploadsGrid'
import { useDeleteUpload } from './use-delete-upload'

export interface UploadsTabProps {
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  selected: UploadItem[]
  onSelect: (item: UploadItem) => void
  onUploaded: (items: UploadItem[]) => void
  onDeleted?: (id: string) => void
  uploading?: UploadProgressItem[]
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
}

/** Uploads grid host with selection and delete confirmation. */
export function UploadsTab(props: UploadsTabProps) {
  const {
    kinds,
    max,
    extensions,
    selected,
    onSelect: handleSelect,
    onUploaded: handleUploaded,
    onDeleted,
    uploading = [],
    onRetry: handleRetryUpload,
    onDismiss: handleDismissUpload,
  } = props
  const { data, isLoading, mutate } = useSWR(['uploads', kinds], () => fetchUploads({ kinds }))
  const { data: canChooseFiles } = useSWR('platform-choose', async () =>
    (await getPlatform()).canChooseFiles(),
  )
  const items = (data ?? []).filter((item) =>
    extensionAllowed({ kind: item.kind, ext: item.ext, extensions }),
  )
  const selectedIds = selected.map((item) => item.id)
  const isMaxReached = selected.length >= max
  const handleAvailable = (item: UploadItem) => {
    if (selectedIds.includes(item.id)) return ['deselect' as const]

    if (isMaxReached) return []

    return ['select' as const]
  }
  const actions: PreviewActions = {
    select: handleSelect,
    deselect: handleSelect,
    available: handleAvailable,
  }
  const deletion = useDeleteUpload({ mutate, onDeleted })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        Uploads
      </div>

      <UploadsGrid
        items={items}
        uploading={uploading}
        selectedIds={selectedIds}
        isMaxReached={isMaxReached}
        isLoading={isLoading}
        canChooseFiles={canChooseFiles === true}
        kinds={kinds}
        max={max}
        extensions={extensions}
        actions={actions}
        onUploaded={handleUploaded}
        onRetry={handleRetryUpload}
        onDismiss={handleDismissUpload}
        onSelect={handleSelect}
        onDelete={deletion.handleDeleteRequest}
      />

      <DeleteUploadDialog
        isOpen={!isNil(deletion.pending)}
        isDeleting={deletion.isDeleting}
        onOpenChange={deletion.handlePendingOpenChange}
        onCancel={deletion.handleCancelDelete}
        onConfirm={deletion.handleConfirmDelete}
      />
    </div>
  )
}
