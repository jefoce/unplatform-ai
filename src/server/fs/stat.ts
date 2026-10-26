import 'server-only'

import fs from 'node:fs/promises'

export async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

/** ENOSPC is retried after a pause, not only after a restart. */
export function isDiskFull(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOSPC'
}
