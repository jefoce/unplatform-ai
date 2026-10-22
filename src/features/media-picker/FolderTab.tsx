'use client'

import { useCallback, useState } from 'react'
import { isEmpty } from 'lodash-es'
import useSWR from 'swr'

import { extensionAllowed, extWithDot, mimeFromExt } from '@/core/media-kinds'
import type { FolderFile, MediaKind } from '@/core/types'
import { openPreview, type PreviewItem } from '@/features/preview/preview-store'

import { fetchFolderFiles, thumbUrl } from './api'
import { FolderBreadcrumbs } from './FolderBreadcrumbs'
import { FolderDirTile } from './FolderDirTile'
import { FolderFileTile } from './FolderFileTile'
import type { PickerExtensions } from './store'

export interface FolderTabProps {
  folderId: string
  folderName: string
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  sub: string
  selectedRels: string[]
  onPickFile: (rel: string) => void
  onNavigate: (sub: string) => void
  onToggleFile: (rel: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

interface FolderPreviewItemParams {
  folderId: string
  file: FolderFile
}

/** Preview-only item for a folder file. Nothing links until Add. */
function folderPreviewItem(params: FolderPreviewItemParams): PreviewItem {
  const { folderId, file } = params
  const ext = extWithDot(file.name)

  return {
    id: `folder:${folderId}:${file.rel}`,
    source: 'link',
    kind: file.kind,
    mime: mimeFromExt(ext) ?? '',
    ext,
    originalName: file.name,
    sizeBytes: file.sizeBytes,
    createdAt: new Date(file.mtimeMs).toISOString(),
    previewRef: `folders/${folderId}/${file.rel}`,
  }
}

/** Folder browser. */
export function FolderTab(props: FolderTabProps) {
  const { folderId, folderName, kinds, max, extensions, sub, selectedRels } = props
  const { onPickFile, onNavigate: handleNavigate, onToggleFile } = props
  const handleSelectFile = useCallback(
    (rel: string) => {
      if (max === 1) {
        onPickFile(rel)

        return
      }

      onToggleFile(rel)
    },
    [max, onPickFile, onToggleFile],
  )

  const [broken, setBroken] = useState<string[]>([])
  const { data, isLoading } = useSWR(['folder-files', folderId, sub, kinds], () =>
    fetchFolderFiles({ folderId, sub, kinds }),
  )
  const dirs = data?.dirs ?? []
  const files = (data?.files ?? []).filter((file) =>
    extensionAllowed({ kind: file.kind, ext: extWithDot(file.name), extensions }),
  )

  const handleExpand = useCallback(
    (file: FolderFile) => {
      const handleSelect = () => handleSelectFile(file.rel)

      openPreview({
        items: [folderPreviewItem({ folderId, file })],
        index: 0,
        actions: { select: handleSelect },
      })
    },
    [folderId, handleSelectFile],
  )

  const handleBroken = useCallback((src: string) => setBroken((previous) => [...previous, src]), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <FolderBreadcrumbs folderName={folderName} sub={sub} onNavigate={handleNavigate} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 content-start gap-3 p-3">
          {isLoading &&
            SKELETON.map((key) => (
              <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))}

          {dirs.map((dir) => (
            <FolderDirTile key={dir.rel} dir={dir} onNavigate={handleNavigate} />
          ))}

          {files.map((file) => {
            const ref = `folders/${folderId}/${file.rel}`
            const src = thumbUrl({ ref, w: undefined, version: file.mtimeMs })
            const isBroken = broken.includes(src)

            return (
              <FolderFileTile
                key={file.rel}
                file={file}
                src={src}
                isBroken={isBroken}
                isSelected={selectedRels.includes(file.rel)}
                onPickFile={handleSelectFile}
                onExpand={handleExpand}
                onBroken={handleBroken}
              />
            )
          })}

          {!isLoading && isEmpty(dirs) && isEmpty(files) && (
            <p className="col-span-full py-8 text-center text-sm text-fg-2">
              No media in this folder
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
