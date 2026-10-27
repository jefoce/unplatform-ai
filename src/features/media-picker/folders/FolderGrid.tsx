'use client'

import { isEmpty } from 'lodash-es'

import type { FolderDir, FolderFile, MediaKind } from '@/core/media-types'
import { referenceSlots } from '@/core/prompt-tokens'
import type { UploadsById } from '@/core/schemas/upload-item'
import { thumbUrl } from '@/lib/api/media-urls'

import type { PickerMode } from '../picker/store'
import { FolderDirTile } from './FolderDirTile'
import { FolderGridTile } from './FolderGridTile'

interface FolderGridProps {
  folderId: string
  folderPath: string
  dirs: FolderDir[]
  files: FolderFile[]
  mode: PickerMode
  selectedIds: string[]
  uploadsById: UploadsById
  linkingRel: string | null
  broken: string[]
  isLoading: boolean
  onNavigate: (sub: string) => void
  onSelect: (rel: string) => void
  onExpand: (file: FolderFile) => void
  onBroken: (src: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

/** Folder grid with skeleton, directory tiles, media tiles and the empty note. */
export function FolderGrid(props: FolderGridProps) {
  const { folderId, folderPath, dirs, files, mode, selectedIds, uploadsById, linkingRel } = props
  const isEmptyList = isEmpty(dirs) && isEmpty(files)
  const isInitialLoading = props.isLoading && isEmptyList

  const kindOfUpload = (id: string): MediaKind | undefined => {
    return uploadsById[id]?.kind
  }

  const slots = referenceSlots(selectedIds, kindOfUpload).slots

  return (
    <div className="min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto overscroll-contain">
      <div className="grid grid-cols-4 content-start gap-3 p-3">
        {dirs.map((dir) => {
          return <FolderDirTile key={dir.rel} dir={dir} onNavigate={props.onNavigate} />
        })}

        {files.map((file) => {
          const src = thumbUrl({
            ref: `folders/${folderId}/${file.rel}`,
            w: undefined,
            version: file.mtimeMs,
          })

          return (
            <FolderGridTile
              key={file.rel}
              folderId={folderId}
              folderPath={folderPath}
              file={file}
              src={src}
              mode={mode}
              selectedIds={selectedIds}
              uploadsById={uploadsById}
              slots={slots}
              linkingRel={linkingRel}
              isBroken={props.broken.includes(src)}
              onSelect={props.onSelect}
              onExpand={props.onExpand}
              onBroken={props.onBroken}
            />
          )
        })}

        {isInitialLoading &&
          SKELETON.map((key) => {
            return <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
          })}

        {!props.isLoading && isEmptyList && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">
            No media in this folder
          </p>
        )}
      </div>
    </div>
  )
}
