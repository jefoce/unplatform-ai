import { isNil } from 'lodash-es'

import { folderFileUpload } from '@/core/folder-match'
import { isNonEmptyString } from '@/core/guards'
import { extWithDot, mimeFromExt } from '@/core/media-kinds'
import type { FolderFile, MediaKind } from '@/core/media-types'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import type { ActionKey, PreviewActions, PreviewItem } from '@/features/preview/preview-store'
import type { LatestRef } from '@/lib/use-latest'

import { closeMediaPicker, type PickerMode } from '../picker/store'

interface FolderPreviewItemParams {
  folderId: string
  folderPath: string
  file: FolderFile
}

/** Preview-only item for a folder file. Nothing links until selected. */
export function folderPreviewItem(params: FolderPreviewItemParams): PreviewItem {
  const { folderId, folderPath, file } = params
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
    folderPath,
  }
}

/** Rel path of a folder preview item, undefined for other sources. */
function previewRel(folderId: string, item: PreviewItem): string | undefined {
  const prefix = `folders/${folderId}/`
  const ref = item.previewRef

  if (!isNonEmptyString(ref) || !ref.startsWith(prefix)) {
    return undefined
  }

  return ref.slice(prefix.length)
}

/** Applies a linked folder file through the request mode. */
export function applyPicked(mode: PickerMode, upload: UploadItem): void {
  if (mode.kind === 'toggle') {
    mode.onToggle(upload)

    return
  }

  mode.onPick(upload)
  closeMediaPicker()
}

interface FolderFileReasonParams {
  mode: PickerMode
  isSelected: boolean
  id: string
  kind: MediaKind
}

/** Reason a folder file cannot be picked, undefined when it can. */
export function folderFileReason(params: FolderFileReasonParams): string | undefined {
  const { mode, isSelected, id, kind } = params

  if (mode.kind !== 'toggle' || isSelected) {
    return undefined
  }

  return mode.canAdd({ id, kind }) ?? undefined
}

interface FolderPreviewActionsParams {
  folderId: string
  folderPath: string
  mode: PickerMode
  onSelect: (rel: string) => void
  selectedIds: LatestRef<string[]>
  uploadsById: LatestRef<UploadsById>
}

/** Preview actions toggle the shown file and keep the preview open in toggle mode. */
export function folderPreviewActions(params: FolderPreviewActionsParams): PreviewActions {
  const { folderId, folderPath, mode, onSelect, selectedIds, uploadsById } = params

  const resolveUpload = (rel: string): UploadItem | null => {
    return folderFileUpload({
      folderPath,
      rel,
      selectedIds: selectedIds.current,
      uploadsById: uploadsById.current,
    })
  }

  const run = (item: PreviewItem): boolean => {
    const rel = previewRel(folderId, item)

    if (isNil(rel)) {
      return false
    }

    onSelect(rel)

    return mode.kind === 'toggle'
  }

  if (mode.kind !== 'toggle') {
    return { select: run }
  }

  const isSelected = (item: PreviewItem): boolean => {
    const rel = previewRel(folderId, item)

    return !isNil(rel) && !isNil(resolveUpload(rel))
  }

  const available = (item: PreviewItem): ActionKey[] => {
    const rel = previewRel(folderId, item)

    if (isNil(rel)) {
      return []
    }

    if (!isNil(resolveUpload(rel))) {
      return ['deselect']
    }

    if (!isNil(mode.canAdd({ id: item.id, kind: item.kind }))) {
      return []
    }

    return ['select']
  }

  return { select: run, deselect: run, isSelected, available }
}
