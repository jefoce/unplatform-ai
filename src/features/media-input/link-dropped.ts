import { toast } from 'sonner'

import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import { linkPaths } from '@/lib/platform/link-paths'

/** A path with an extension is a file candidate, anything else is likely a folder. */
function looksLikeFile(path: string): boolean {
  return /\.[^\\/]+$/.test(path)
}

interface LinkDroppedPathsParams {
  paths: string[]
  kinds: readonly MediaKind[]
  extensions?: KindExtensions
}

/** Links dropped desktop paths zero-copy, hinting at folders and unsupported files. */
export async function linkDroppedPaths(params: LinkDroppedPathsParams): Promise<UploadItem[]> {
  const { paths, kinds, extensions } = params

  const candidates = paths.map((path) => {
    return { name: path, type: '' }
  })

  const { accepted, skipped } = acceptFiles({ files: candidates, kinds, extensions })

  const folders = candidates.filter((file) => {
    return !looksLikeFile(file.name)
  }).length

  const unsupported = skipped - folders

  if (folders > 0) {
    toast('Folders: use Add folder')
  }

  if (unsupported > 0) {
    const suffix = unsupported === 1 ? '' : 's'

    toast(`Skipped ${unsupported} unsupported file${suffix}`)
  }

  return linkPaths(
    accepted.map((file) => {
      return file.name
    }),
  )
}
