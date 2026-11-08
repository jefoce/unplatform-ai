'use client'

import { isNil } from 'lodash-es'

import type { FolderFile } from '@/core/api/folders'
import type { UploadsById } from '@/core/api/uploads'
import { folderFileUpload } from '@/core/folder-match'
import type { RefSlot } from '@/core/prompt-tokens'

import type { PickerMode } from '../picker/store'
import { folderFileReason } from './folder-tab-helpers'
import { FolderFileTile } from './FolderFileTile'

interface FolderGridTileProps {
  folderId: string
  folderPath: string
  file: FolderFile
  src: string
  audioSrc: string
  mode: PickerMode
  selectedIds: string[]
  uploadsById: UploadsById
  slots: Map<string, RefSlot>
  linkingRel: string | null
  isBroken: boolean
  onSelect: (rel: string) => void
  onExpand: (file: FolderFile) => void
  onBroken: (src: string) => void
}

/** Folder grid tile with its live attachment and busy state. */
export function FolderGridTile(props: FolderGridTileProps) {
  const {
    folderId,
    folderPath,
    file,
    src,
    audioSrc,
    mode,
    selectedIds,
    uploadsById,
    slots,
    linkingRel,
  } = props

  const upload = folderFileUpload({ folderPath, rel: file.rel, selectedIds, uploadsById })
  const isSelected = !isNil(upload)

  let slotNumber: number | undefined

  if (!isNil(upload)) {
    slotNumber = slots.get(upload.id)?.n
  }

  const disabledReason = folderFileReason({
    mode,
    isSelected,
    id: `folder:${folderId}:${file.rel}`,
    kind: file.kind,
  })

  return (
    <FolderFileTile
      file={file}
      src={src}
      audioSrc={audioSrc}
      isBroken={props.isBroken}
      isSelected={isSelected}
      slotNumber={slotNumber}
      isDisabled={!isNil(disabledReason)}
      disabledReason={disabledReason}
      isBusy={linkingRel === file.rel}
      onSelect={props.onSelect}
      onExpand={props.onExpand}
      onBroken={props.onBroken}
    />
  )
}
