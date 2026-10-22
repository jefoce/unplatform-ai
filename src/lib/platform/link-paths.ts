import { chunk } from 'lodash-es'
import { toast } from 'sonner'

import type { UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { linkAbsPath } from './system-api'

/** Links paths 3 at a time. One toast per failure, the rest still reach the UI. */
export async function linkPaths(paths: string[]): Promise<UploadItem[]> {
  const items: UploadItem[] = []

  for (const group of chunk(paths, 3)) {
    const results = await Promise.allSettled(group.map((file) => linkAbsPath(file)))

    for (const result of results) {
      if (result.status === 'fulfilled') items.push(result.value)
      else toast.error(errorMessage(result.reason))
    }
  }

  return items
}
