import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { commitFile } from '@/server/fs/atomic-file'
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

/** Existing absolute folder that is not a symlink, or null. */
export async function exportDir(dir: string): Promise<string | null> {
  if (!path.isAbsolute(dir)) {
    return null
  }

  const folder = await fs.lstat(dir).catch(() => {
    return null
  })

  if (!folder || folder.isSymbolicLink() || !folder.isDirectory()) {
    return null
  }

  return dir
}

/** Copies through a fsynced temp file, so a crash never leaves a partial export. */
export async function copyAtomic(source: string, target: string): Promise<void> {
  const temp = `${target}.tmp-${randomUUID()}`

  try {
    await fs.copyFile(source, temp)
    await commitFile({ temp, target })
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    throw error
  }
}

/** Copies without overwriting. False when the target already exists. */
export async function copyExclusive(source: string, target: string): Promise<boolean> {
  const isTargetPresent = await fs.access(target).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )

  if (isTargetPresent) {
    return false
  }

  const temp = `${target}.tmp-${randomUUID()}`

  try {
    await fs.copyFile(source, temp)
    await commitFile({ temp, target, isExclusive: true })

    return true
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }

    throw error
  }
}

interface CopyUniqueParams {
  source: string
  dir: string
  base: string
  ext: string
}

/** First free `name.ext`, `name (2).ext`, ... using exclusive copies. */
export async function copyUnique(params: CopyUniqueParams): Promise<string> {
  const { source, dir, base, ext } = params

  for (let index = 1; index < 1000; index += 1) {
    const name = index === 1 ? `${base}.${ext}` : `${base} (${index}).${ext}`
    const target = path.join(dir, name)

    if (await copyExclusive(source, target)) {
      return target
    }
  }

  throw new Error('Too many files with the same name')
}
