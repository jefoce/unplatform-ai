import type { MediaKind } from '../media/media-types'

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

export interface BrowseDir {
  name: string
  path: string
}

/** Directory browser result for the add-folder dialog. */
export interface BrowseResult {
  path: string
  parent: string | null
  dirs: BrowseDir[]
}
