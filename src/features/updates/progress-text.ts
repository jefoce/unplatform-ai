import { isNil } from 'lodash-es'

import type { UpdateProgress } from '@/lib/platform/update-schemas'

/** Progress line shared by the App section and the install toast. */
export function progressText(progress: UpdateProgress): string {
  if (progress.phase === 'installing') {
    return 'Installing...'
  }

  if (isNil(progress.total) || progress.total <= 0) {
    return 'Downloading...'
  }

  return `Downloading ${Math.round((progress.downloaded / progress.total) * 100)}%`
}
