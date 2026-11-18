import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

import { escapeRegExp, isNil } from 'lodash-es'

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

/** Real directory behind an absolute folder path, or null. Resolves symlinks. */
export async function exportDir(dir: string): Promise<string | null> {
  if (!path.isAbsolute(dir)) {
    return null
  }

  const resolved = await fs.realpath(dir).catch(() => {
    return null
  })

  if (isNil(resolved)) {
    return null
  }

  const folder = await fs.stat(resolved).catch(() => {
    return null
  })

  if (isNil(folder) || !folder.isDirectory()) {
    return null
  }

  return resolved
}

/** Removes temps a previous attempt left for this exact target. Touches nothing else. */
async function removeTargetTemps(target: string): Promise<void> {
  const dir = path.dirname(target)
  const prefix = `${path.basename(target)}.tmp-`

  const names: string[] = await fs.readdir(dir).catch(() => {
    return []
  })

  for (const name of names) {
    if (!name.startsWith(prefix)) {
      continue
    }

    await fs.unlink(path.join(dir, name)).catch(() => {})
  }
}

/** Copies through a fsynced temp file, so a crash never leaves a partial export. */
export async function copyAtomic(source: string, target: string): Promise<void> {
  await removeTargetTemps(target)

  const temp = `${target}.tmp-${randomUUID()}`

  try {
    await fs.copyFile(source, temp)
    await commitFile({ temp, target })
  } catch (error) {
    await fs.unlink(temp).catch(() => {})

    throw error
  }
}

/**
 * True when the path exists, a symlink pointing nowhere included.
 */
async function pathExists(target: string): Promise<boolean> {
  return fs.access(target).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

/**
 * Copies without overwriting. False when the target already exists.
 */
export async function copyExclusive(source: string, target: string): Promise<boolean> {
  if (await pathExists(target)) {
    return false
  }

  await removeTargetTemps(target)

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

/** SHA-256 of the file, streamed so a long video never sits in memory. */
async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')

  await pipeline(createReadStream(file), hash)

  return hash.digest('hex')
}

/** True when both paths are regular files with the same size and bytes. */
async function isSameFile(existing: string, source: string): Promise<boolean> {
  const target = await fs.lstat(existing).catch(() => {
    return null
  })

  if (isNil(target) || !target.isFile()) {
    return false
  }

  const origin = await fs.stat(source).catch(() => {
    return null
  })

  if (isNil(origin) || origin.size !== target.size) {
    return false
  }

  const [targetHash, sourceHash] = await Promise.all([hashFile(existing), hashFile(source)])

  return targetHash === sourceHash
}

interface CopyUniqueParams {
  source: string
  dir: string
  base: string
  ext: string
}

interface CopyUniqueResult {
  path: string
  isDuplicate: boolean
}

interface FamilyIndexesParams {
  dir: string
  base: string
  ext: string
}

/**
 * Existing indexes of the family `name.ext`, `name-2.ext`, ... in ascending order.
 */
async function familyIndexes(params: FamilyIndexesParams): Promise<number[]> {
  const { dir, base, ext } = params
  const family = new RegExp(`^${escapeRegExp(base)}(?:-(\\d+))?\\.${escapeRegExp(ext)}$`)
  const names = await fs.readdir(dir)
  const indexes: number[] = []

  for (const name of names) {
    const match = family.exec(name)

    if (isNil(match)) {
      continue
    }

    indexes.push(Number(match[1] ?? 1))
  }

  return indexes.sort((first, second) => {
    return first - second
  })
}

/**
 * Identical file among `name.ext`, `name-2.ext`, ... or the first free one.
 */
export async function copyUnique(params: CopyUniqueParams): Promise<CopyUniqueResult> {
  const { source, dir, base, ext } = params
  const indexes = await familyIndexes({ dir, base, ext })

  const nameOf = (index: number): string => {
    if (index === 1) {
      return `${base}.${ext}`
    }

    return `${base}-${index}.${ext}`
  }

  // Every output of one model shares a base, so a gap must not hide later variants.
  for (const index of indexes) {
    const target = path.join(dir, nameOf(index))

    if (await isSameFile(target, source)) {
      return { path: target, isDuplicate: true }
    }
  }

  const used = new Set(indexes)

  for (let index = 1; ; index += 1) {
    if (used.has(index)) {
      continue
    }

    const target = path.join(dir, nameOf(index))

    if (await copyExclusive(source, target)) {
      return { path: target, isDuplicate: false }
    }

    if (await isSameFile(target, source)) {
      return { path: target, isDuplicate: true }
    }
  }
}
