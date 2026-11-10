'use client'

import { isEmpty } from 'lodash-es'

import type { FolderDir, FolderFile } from '@/core/api/folders'
import type { UploadsById } from '@/core/api/uploads'
import { extWithDot, mimeFromExt } from '@/core/media/media-kinds'
import type { MediaKind } from '@/core/media/media-types'
import { referenceSlots } from '@/core/prompt-tokens'
import { mediaUrl, thumbUrl } from '@/lib/api/media-urls'

import type { PickerMode } from '../picker/store'
import { PICKER_GRID_CLASSES, PICKER_GRID_STYLE } from '../tiles/tile-classes'
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
      <div className={PICKER_GRID_CLASSES} style={PICKER_GRID_STYLE}>
        {dirs.map((dir) => {
          return <FolderDirTile key={dir.rel} dir={dir} onNavigate={props.onNavigate} />
        })}

        {files.map((file) => {
          const ref = `folders/${folderId}/${file.rel}`
          const src = thumbUrl({ ref, w: undefined })
          const audioSrc = mediaUrl(ref, mimeFromExt(extWithDot(file.name)) ?? undefined)

          return (
            <FolderGridTile
              key={file.rel}
              folderId={folderId}
              folderPath={folderPath}
              file={file}
              src={src}
              audioSrc={audioSrc}
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
