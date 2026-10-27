'use client'

import { useState } from 'react'
import useSWR from 'swr'

import { extensionAllowed, extWithDot, type KindExtensions } from '@/core/media-kinds'
import type { FolderFile, MediaKind } from '@/core/media-types'
import type { UploadsById } from '@/core/schemas/upload-item'
import { openPreview } from '@/features/preview/preview-store'
import { fetchFolderFiles } from '@/lib/api/folders'
import { useLatest } from '@/lib/use-latest'

import type { PickerMode } from '../picker/store'
import { folderPreviewActions, folderPreviewItem } from './folder-tab-helpers'
import { FolderBreadcrumbs } from './FolderBreadcrumbs'
import { FolderGrid } from './FolderGrid'
import { useFolderLink } from './use-folder-link'

export interface FolderTabProps {
  folderId: string
  folderPath: string
  folderName: string
  kinds: MediaKind[]
  extensions?: KindExtensions
  sub: string
  mode: PickerMode
  onNavigate: (sub: string) => void
}

const NO_SELECTED_IDS: string[] = []
const NO_UPLOADS_BY_ID: UploadsById = {}

function useNoSelectedIds(): string[] {
  return NO_SELECTED_IDS
}

function useNoUploadsById(): UploadsById {
  return NO_UPLOADS_BY_ID
}

/** Folder browser. */
export function FolderTab(props: FolderTabProps) {
  const { folderId, folderPath, folderName, kinds, extensions, sub, mode } = props

  // Mode is fixed for the mount, so the hook choice stays stable.
  const useSelectedIds = mode.kind === 'toggle' ? mode.useSelectedIds : useNoSelectedIds
  const useUploadsById = mode.kind === 'toggle' ? mode.useUploadsById : useNoUploadsById
  const selectedIds = useSelectedIds()
  const uploadsById = useUploadsById()
  const selectedIdsRef = useLatest(selectedIds)
  const uploadsByIdRef = useLatest(uploadsById)

  const { linkingRel, handleSelectFile } = useFolderLink({
    folderId,
    folderPath,
    mode,
    selectedIds: selectedIdsRef,
    uploadsById: uploadsByIdRef,
  })

  const [broken, setBroken] = useState<string[]>([])

  const { data, isLoading } = useSWR(
    ['folder-files', folderId, sub, kinds],
    () => {
      return fetchFolderFiles({ folderId, sub, kinds })
    },
    { keepPreviousData: true },
  )

  const dirs = data?.dirs ?? []

  const files = (data?.files ?? []).filter((file) => {
    return extensionAllowed({ kind: file.kind, ext: extWithDot(file.name), extensions })
  })

  const handleExpand = (file: FolderFile) => {
    const items = files.map((each) => {
      return folderPreviewItem({ folderId, folderPath, file: each })
    })

    const index = files.findIndex((each) => {
      return each.rel === file.rel
    })

    const previewActions = folderPreviewActions({
      folderId,
      folderPath,
      mode,
      onSelect: handleSelectFile,
      selectedIds: selectedIdsRef,
      uploadsById: uploadsByIdRef,
    })

    openPreview({ items, index, actions: previewActions, allowUse: false })
  }

  const handleBroken = (src: string) => {
    setBroken((previous) => {
      return [...previous, src]
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <FolderBreadcrumbs folderName={folderName} sub={sub} onNavigate={props.onNavigate} />
      </div>

      <FolderGrid
        folderId={folderId}
        folderPath={folderPath}
        dirs={dirs}
        files={files}
        mode={mode}
        selectedIds={selectedIds}
        uploadsById={uploadsById}
        linkingRel={linkingRel}
        broken={broken}
        isLoading={isLoading}
        onNavigate={props.onNavigate}
        onSelect={handleSelectFile}
        onExpand={handleExpand}
        onBroken={handleBroken}
      />
    </div>
  )
}
