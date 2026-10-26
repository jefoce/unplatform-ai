import { constants } from 'node:fs'
import fs from 'node:fs/promises'

import { downloadPaths } from '@/server/paths'

/** Existing absolute path of the record's video, or null. */
export async function videoSource(id: string): Promise<string | null> {
  const source = downloadPaths(id).video

  const isFile = await fs.stat(source).then(
    (stats) => {
      return stats.isFile()
    },
    () => {
      return false
    },
  )

  if (isFile) {
    return source
  }

  return null
}

/** Copies without overwriting. False when the target already exists. */
export async function copyExclusive(source: string, target: string): Promise<boolean> {
  try {
    await fs.copyFile(source, target, constants.COPYFILE_EXCL)

    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }

    throw error
  }
}
