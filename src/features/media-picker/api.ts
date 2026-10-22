import { isEmpty, isNil } from 'lodash-es'

import { THUMB_WIDTH } from '@/core/constants'
import type { BrowseResult, FolderItem, FolderListing, MediaKind, UploadItem } from '@/core/types'
import { apiDelete, apiPost, fetcher } from '@/lib/fetcher'
import { canPlay } from '@/lib/media-support'

export * from '@/lib/platform/system-api'

export interface FetchUploadsParams {
  kinds?: MediaKind[]
  ids?: string[]
}

function withQuery(base: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (!isNil(value) && value !== '') query.set(key, value)
  }

  const qs = query.toString()

  return isEmpty(qs) ? base : `${base}?${qs}`
}

const encodeRef = (ref: string): string => ref.split('/').map(encodeURIComponent).join('/')

export function fetchUploads(params: FetchUploadsParams = {}): Promise<UploadItem[]> {
  return fetcher<UploadItem[]>(
    withQuery('/api/uploads', {
      kind: isNil(params.kinds) || params.kinds.length === 0 ? undefined : params.kinds.join(','),
      ids: isNil(params.ids) || params.ids.length === 0 ? undefined : params.ids.join(','),
    }),
  )
}

interface UploadFilesWithProgressParams {
  files: File[]
  onProgress: (sent: number, total: number) => void
  signal?: AbortSignal
}

/** Multipart upload with byte progress from `XMLHttpRequest`. */
export function uploadFilesWithProgress(
  params: UploadFilesWithProgressParams,
): Promise<UploadItem[]> {
  const { files, onProgress, signal } = params
  const form = new FormData()

  for (const file of files) form.append('file', file)

  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new DOMException('Upload cancelled', 'AbortError'))

      return
    }

    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/uploads')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => onProgress(event.loaded, event.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response ?? []) as UploadItem[])

        return
      }

      reject(new Error(serverErrorText(xhr)))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

function serverErrorText(xhr: XMLHttpRequest): string {
  const body = xhr.response as { error?: string } | null
  const text = isEmpty(xhr.statusText) ? `Upload failed (${xhr.status})` : xhr.statusText

  return body?.error ?? text
}

export function uploadFiles(files: File[]): Promise<UploadItem[]> {
  return uploadFilesWithProgress({ files, onProgress: () => {} })
}

export function linkFolderFile(input: { folderId: string; relPath: string }): Promise<UploadItem> {
  return apiPost<UploadItem>('/api/uploads/link', input)
}

export function deleteUpload(id: string): Promise<void> {
  return apiDelete<void>(`/api/uploads/${encodeURIComponent(id)}`)
}

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

  return fetcher<FolderListing>(
    withQuery(`/api/folders/${encodeURIComponent(folderId)}/files`, {
      sub: isEmpty(sub) ? undefined : sub,
      kind: isNil(kinds) || kinds.length === 0 ? undefined : kinds.join(','),
    }),
  )
}

export function browseDirs(path?: string, isHidden = false): Promise<BrowseResult> {
  return fetcher<BrowseResult>(
    withQuery('/api/fs/browse', { path, hidden: isHidden ? '1' : undefined }),
  )
}

interface ThumbUrlParams {
  ref: string
  w?: number
  version?: string | number
}

/** Media stream URL, routed through the compat copy when the MIME cannot play. */
export function mediaUrl(ref: string, mime?: string): string {
  const [pathRef, query = ''] = ref.split('?')
  const base = `/api/media/${encodeRef(pathRef)}`
  const plainUrl = isEmpty(query) ? base : `${base}?${query}`

  if (isNil(mime) || mime === '' || canPlay(mime)) return plainUrl

  const params = new URLSearchParams(query)

  params.set('compat', '1')

  return `${base}?${params.toString()}`
}

/** Thumbnail URL for a ref, encoding each path segment. */
export function thumbUrl(params: ThumbUrlParams): string {
  const { ref, w = THUMB_WIDTH, version } = params
  const query = new URLSearchParams({ w: String(w) })

  if (!isNil(version)) query.set('v', String(version))

  return `/api/thumbs/${encodeRef(ref)}?${query.toString()}`
}
