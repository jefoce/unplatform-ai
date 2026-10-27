import { isNil } from 'lodash-es'

import type { UploadItem, UploadsById } from './schemas/upload-item'

export interface FolderTarget {
  folderPath: string
  rel: string
}

export interface FolderFileUploadParams extends FolderTarget {
  selectedIds: string[]
  uploadsById: UploadsById
}

/** Forward slashes, no duplicate or trailing slash. Does not resolve `..`. */
function normalizePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replaceAll(/\/{2,}/g, '/')
    .replaceAll(/\/+$/g, '')
}

/** Absolute path of a folder file, normalized for comparison. */
export function folderTargetPath(params: FolderTarget): string {
  const { folderPath, rel } = params

  return normalizePath(`${folderPath}/${rel}`)
}

/** First selected upload whose link target is the folder file, null when none. */
export function folderFileUpload(params: FolderFileUploadParams): UploadItem | null {
  const { folderPath, rel, selectedIds, uploadsById } = params
  const target = folderTargetPath({ folderPath, rel })

  for (const id of selectedIds) {
    const upload = uploadsById[id]

    if (isNil(upload) || isNil(upload.target)) {
      continue
    }

    if (normalizePath(upload.target) === target) {
      return upload
    }
  }

  return null
}

/** True when a selected upload points at the folder file. */
export function isFolderFileAttached(params: FolderFileUploadParams): boolean {
  return !isNil(folderFileUpload(params))
}
