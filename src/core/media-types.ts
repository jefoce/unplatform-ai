export type MediaKind = 'image' | 'video' | 'audio'

type UploadSource = 'file' | 'link'

export type LinkMode = 'symlink' | 'hardlink' | 'copy'

export interface UploadItem {
  id: string
  source: UploadSource
  kind: MediaKind
  mime: string
  ext: string
  originalName: string
  target?: string
  linkMode?: LinkMode
  sizeBytes: number
  width?: number
  height?: number
  durationSec?: number
  createdAt: string
  missing?: boolean
  remote?: {
    key: string
    sha256: string
    serverSha256: string | null
    size: number
    mtimeMs: number
    uploadedAt: string
    lastUsedAt: string
  }
}

export interface FolderItem {
  id: string
  name: string
  path: string
  addedAt: string
}

export interface FolderDir {
  name: string
  rel: string
}

export interface FolderFile {
  name: string
  rel: string
  kind: MediaKind
  sizeBytes: number
  mtimeMs: number
}

/** One folder level listing for the picker. */
export interface FolderListing {
  path: string
  dirs: FolderDir[]
  files: FolderFile[]
}

/** Directory browser result for the add-folder dialog. */
export interface BrowseResult {
  path: string
  parent: string | null
  dirs: { name: string; path: string }[]
}

/** Planned encoding for the attached images. One step for the whole request. */
export interface ReferencePlan {
  step: number
  maxSide: number
  totalBytes: number
  images: ReferencePlanImage[]
}

interface ReferencePlanImage {
  id: string
  width: number
  height: number
  bytes: number
  format: 'jpeg' | 'png'
  flattened?: '#ffffff' | '#1c1e20'
}
