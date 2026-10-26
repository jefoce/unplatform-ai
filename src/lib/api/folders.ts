import { isNil } from 'lodash-es'

import type { BrowseResult, FolderListing, MediaKind } from '@/core/media-types'
import type { FolderItem } from '@/core/schemas/folder-item'
import { apiDelete, apiPost, fetcher } from '@/lib/fetcher'

import { withQuery } from './query'

export function fetchFolders(): Promise<FolderItem[]> {
  return fetcher<FolderItem[]>('/api/folders')
}

export function createFolder(path: string): Promise<FolderItem> {
  return apiPost<FolderItem>('/api/folders', { path })
}

export function deleteFolder(id: string): Promise<void> {
  return apiDelete<void>(`/api/folders/${encodeURIComponent(id)}`)
}

interface FetchFolderFilesParams {
  folderId: string
  sub?: string
  kinds?: MediaKind[]
}

export function fetchFolderFiles(params: FetchFolderFilesParams): Promise<FolderListing> {
  const { folderId, sub = '', kinds } = params
  const subQuery = sub === '' ? undefined : sub
  let kindQuery: string | undefined

  if (!isNil(kinds) && kinds.length > 0) {
    kindQuery = kinds.join(',')
  }

  return fetcher<FolderListing>(
    withQuery(`/api/folders/${encodeURIComponent(folderId)}/files`, {
      sub: subQuery,
      kind: kindQuery,
    }),
  )
}

export function browseDirs(path?: string, isHidden = false): Promise<BrowseResult> {
  const hidden = isHidden ? '1' : undefined

  return fetcher<BrowseResult>(withQuery('/api/fs/browse', { path, hidden }))
}
