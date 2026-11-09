/* eslint-disable max-lines -- one module owns folder listing, linking and containment */
import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import fs, { constants } from 'node:fs/promises'
import path from 'node:path'

import { isNil, orderBy } from 'lodash-es'

import type { FolderDir, FolderFile, FolderListing } from '@/core/api/folders'
import { isNonEmptyString } from '@/core/guards'
import { kindFromName } from '@/core/media/media-kinds'
import type { MediaKind } from '@/core/media/media-types'
import { type FolderItem, FoldersFileSchema } from '@/core/schemas/folder-item'

import { HttpError } from '../errors'
import { readJson, readJsonStrict, writeJsonAtomic } from '../fs/json-file'
import { isInside, resolveInside, resolveRealInside, SafePathError } from '../fs/safe-path'
import { FOLDERS_FILE } from '../paths'
import { withLock } from '../sync/lock'

class FolderError extends HttpError {}

export async function listFolders(): Promise<FolderItem[]> {
  const folders = await readJson(FOLDERS_FILE, FoldersFileSchema)

  if (isNil(folders)) {
    return []
  }

  return orderBy(folders, ['addedAt'], ['asc'])
}

/** Missing means no folders yet. A present but unreadable file must not be overwritten. */
async function readFoldersForWrite(): Promise<FolderItem[]> {
  const folders = await readJsonStrict(FOLDERS_FILE, FoldersFileSchema).catch(() => {
    throw new FolderError(500, 'Could not read the folders file')
  })

  return folders ?? []
}

export async function getFolder(id: string): Promise<FolderItem | null> {
  const folders = await listFolders()

  return (
    folders.find((folder) => {
      return folder.id === id
    }) ?? null
  )
}

export interface FolderPathMatch {
  id: string
  relPath: string
}

/** Folder that contains a real file, with a `/`-separated path from its root. */
export async function folderForPath(absPath: string): Promise<FolderPathMatch | null> {
  const real = await fs.realpath(absPath).catch(() => {
    return null
  })

  if (!isNonEmptyString(real)) {
    return null
  }

  for (const folder of await listFolders()) {
    const root = await fs.realpath(folder.path).catch(() => {
      return null
    })

    if (isNil(root) || !isInside(root, real)) {
      continue
    }

    return { id: folder.id, relPath: path.relative(root, real).split(path.sep).join('/') }
  }

  return null
}

interface AddFolderParams {
  path: string
}

export async function addFolder(params: AddFolderParams): Promise<FolderItem> {
  const { path: requestedPath } = params
  const requested = requestedPath.trim()

  if (!path.isAbsolute(requested)) {
    throw new FolderError(400, 'Path must be absolute')
  }

  const real = await fs.realpath(requested).catch(() => {
    return null
  })

  if (!isNonEmptyString(real)) {
    throw new FolderError(404, 'Folder not found')
  }

  const stats = await fs.stat(real).catch(() => {
    return null
  })

  if (!stats) {
    throw new FolderError(404, 'Folder not found')
  }

  if (!stats.isDirectory()) {
    throw new FolderError(400, 'Not a folder')
  }

  const isReadable = await fs.access(real, constants.R_OK).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )

  if (!isReadable) {
    throw new FolderError(403, 'Folder is not readable')
  }

  return withLock('folders', async () => {
    const folders = await readFoldersForWrite()

    for (const folder of folders) {
      const existing = await fs.realpath(folder.path).catch(() => {
        return folder.path
      })

      if (existing === real) {
        throw new FolderError(409, 'Folder already connected')
      }
    }

    const item: FolderItem = {
      id: randomUUID(),
      name: path.basename(real),
      path: real,
      addedAt: new Date().toISOString(),
    }

    await writeJsonAtomic({ file: FOLDERS_FILE, data: [...folders, item] })

    return item
  })
}

/** Removes the tab only. The disk folder and existing links are untouched. */
export async function removeFolder(id: string): Promise<void> {
  await withLock('folders', async () => {
    const folders = await listFolders()

    const next = folders.filter((folder) => {
      return folder.id !== id
    })

    if (next.length === folders.length) {
      return
    }

    await writeJsonAtomic({ file: FOLDERS_FILE, data: next })
  })
}

interface ListFolderFilesParams {
  folderId: string
  sub?: string
  kinds?: MediaKind[]
}

export async function listFolderFiles(params: ListFolderFilesParams): Promise<FolderListing> {
  const { folderId, sub, kinds } = params
  const folder = await getFolder(folderId)

  if (!folder) {
    throw new FolderError(404, `Folder not found: ${folderId}`)
  }

  const current = await resolveSub(folder.path, sub ?? '')
  const entries = await readDirectory(current)

  const visible = entries.filter((entry) => {
    return !entry.name.startsWith('.')
  })

  const relDir = path.relative(folder.path, current).split(path.sep).join('/')

  const relOf = (name: string): string => {
    return path.posix.join(relDir, name)
  }

  const rootReal = await fs.realpath(folder.path).catch(() => {
    return folder.path
  })

  const dirs: FolderDir[] = []
  const files: FolderFile[] = []

  for (const entry of visible) {
    const full = path.join(current, entry.name)
    const rel = relOf(entry.name)
    const outcome = await classifyEntry({ entry, full, rel, rootReal })

    if (outcome.dir) {
      dirs.push(outcome.dir)
    }

    if (!outcome.isFile) {
      continue
    }

    const real = await fs.realpath(full).catch(() => {
      return null
    })

    if (isNil(real) || !isInside(rootReal, real)) {
      continue
    }

    const file = await toFileEntry({ full: real, name: entry.name, rel, kinds })

    if (file) {
      files.push(file)
    }
  }

  return {
    path: relDir,
    dirs: orderBy(dirs, ['name'], ['asc']),
    files: orderBy(files, ['name'], ['asc']),
  }
}

async function readDirectory(dir: string): Promise<Dirent[]> {
  const stats = await fs.stat(dir).catch(() => {
    return null
  })

  if (!stats) {
    throw new FolderError(404, 'Path not found')
  }

  if (!stats.isDirectory()) {
    throw new FolderError(400, 'Not a directory')
  }

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => {
    return null
  })

  if (!entries) {
    throw new FolderError(404, 'Path not found')
  }

  return entries
}

interface ClassifyEntryParams {
  entry: Dirent
  full: string
  rel: string
  rootReal: string
}

interface EntryOutcome {
  dir?: FolderDir
  isFile: boolean
}

async function classifyEntry(params: ClassifyEntryParams): Promise<EntryOutcome> {
  const { entry, full, rel, rootReal } = params

  if (entry.isSymbolicLink()) {
    return classifySymlink({ entry, full, rel, rootReal })
  }

  if (entry.isDirectory()) {
    return { isFile: false, dir: { name: entry.name, rel } }
  }

  return { isFile: true }
}

async function classifySymlink(params: ClassifyEntryParams): Promise<EntryOutcome> {
  const { entry, full, rel, rootReal } = params

  const target = await fs.stat(full).catch(() => {
    return null
  })

  if (!target) {
    return { isFile: false }
  }

  if (!target.isDirectory()) {
    return { isFile: target.isFile() }
  }

  const real = await fs.realpath(full).catch(() => {
    return null
  })

  if (!isNonEmptyString(real) || !isInside(rootReal, real)) {
    return { isFile: false }
  }

  return { isFile: false, dir: { name: entry.name, rel } }
}

interface FileEntryParams {
  full: string
  name: string
  rel: string
  kinds?: MediaKind[]
}

async function toFileEntry(params: FileEntryParams): Promise<FolderFile | null> {
  const { full, name, rel, kinds } = params
  const kind = kindFromName(name)

  if (isNil(kind)) {
    return null
  }

  if (!isNil(kinds) && kinds.length > 0 && !kinds.includes(kind)) {
    return null
  }

  const stats = await fs.stat(full).catch(() => {
    return null
  })

  if (isNil(stats) || !stats.isFile()) {
    return null
  }

  return { name, rel, kind, sizeBytes: stats.size, mtimeMs: stats.mtimeMs }
}

async function resolveSub(root: string, sub: string): Promise<string> {
  try {
    return await resolveRealInside(root, resolveInside(root, sub))
  } catch (error) {
    if (error instanceof SafePathError) {
      throw new FolderError(400, error.message)
    }

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FolderError(404, 'Path not found')
    }

    throw error
  }
}
