import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import fs, { constants } from 'node:fs/promises'
import path from 'node:path'

import { isNil, orderBy } from 'lodash-es'

import { kindFromName } from '@/core/media-kinds'
import type { FolderDir, FolderFile, FolderItem, FolderListing, MediaKind } from '@/core/types'

import { readJson, writeJsonAtomic } from '../fs/json-file'
import { isInside, resolveInside, SafePathError } from '../fs/safe-path'
import { withLock } from '../jobs/lock'
import { FOLDERS_FILE } from '../paths'
import { HttpError } from '../request-guard'

class FolderError extends HttpError {}

export async function listFolders(): Promise<FolderItem[]> {
  const folders = await readJson<FolderItem[]>(FOLDERS_FILE)

  if (!Array.isArray(folders)) return []

  return orderBy(folders, ['addedAt'], ['asc'])
}

export async function getFolder(id: string): Promise<FolderItem | null> {
  const folders = await listFolders()

  return folders.find((folder) => folder.id === id) ?? null
}

interface AddFolderParams {
  path: string
}

export async function addFolder(params: AddFolderParams): Promise<FolderItem> {
  const { path: requestedPath } = params
  const requested = requestedPath.trim()

  if (!path.isAbsolute(requested)) throw new FolderError(400, 'Path must be absolute')

  const real = await fs.realpath(requested).catch(() => null)

  if (isNil(real) || real === '') throw new FolderError(404, 'Folder not found')

  const stats = await fs.stat(real).catch(() => null)

  if (!stats) throw new FolderError(404, 'Folder not found')

  if (!stats.isDirectory()) throw new FolderError(400, 'Not a folder')

  const isReadable = await fs.access(real, constants.R_OK).then(
    () => true,
    () => false,
  )

  if (!isReadable) throw new FolderError(403, 'Folder is not readable')

  return withLock('folders', async () => {
    const folders = await listFolders()

    for (const folder of folders) {
      const existing = await fs.realpath(folder.path).catch(() => folder.path)

      if (existing === real) throw new FolderError(409, 'Folder already connected')
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
    const next = folders.filter((folder) => folder.id !== id)

    if (next.length === folders.length) return

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

  if (!folder) throw new FolderError(404, `Folder not found: ${folderId}`)

  const current = resolveSub(folder.path, sub ?? '')
  const entries = await readDirectory(current)
  const visible = entries.filter((entry) => !entry.name.startsWith('.'))
  const relDir = path.relative(folder.path, current).split(path.sep).join('/')
  const relOf = (name: string): string => path.posix.join(relDir, name)
  const rootReal = await fs.realpath(folder.path).catch(() => folder.path)

  const dirs: FolderDir[] = []
  const files: FolderFile[] = []

  for (const entry of visible) {
    const full = path.join(current, entry.name)
    const rel = relOf(entry.name)
    const outcome = await classifyEntry({ entry, full, rel, rootReal })

    if (outcome.dir) dirs.push(outcome.dir)

    if (!outcome.isFile) continue

    const file = await toFileEntry({ full, name: entry.name, rel, kinds })

    if (file) files.push(file)
  }

  return {
    path: relDir,
    dirs: orderBy(dirs, ['name'], ['asc']),
    files: orderBy(files, ['name'], ['asc']),
  }
}

async function readDirectory(dir: string): Promise<Dirent[]> {
  const stats = await fs.stat(dir).catch(() => null)

  if (!stats) throw new FolderError(404, 'Path not found')

  if (!stats.isDirectory()) throw new FolderError(400, 'Not a directory')

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null)

  if (!entries) throw new FolderError(404, 'Path not found')

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

  if (entry.isSymbolicLink()) return classifySymlink({ entry, full, rel, rootReal })

  if (entry.isDirectory()) return { isFile: false, dir: { name: entry.name, rel } }

  return { isFile: true }
}

async function classifySymlink(params: ClassifyEntryParams): Promise<EntryOutcome> {
  const { entry, full, rel, rootReal } = params
  const target = await fs.stat(full).catch(() => null)

  if (!target) return { isFile: false }

  if (!target.isDirectory()) return { isFile: target.isFile() }

  const real = await fs.realpath(full).catch(() => null)

  if (isNil(real) || real === '' || !isInside(rootReal, real)) return { isFile: false }

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

  if (isNil(kind)) return null

  if (!isNil(kinds) && kinds.length > 0 && !kinds.includes(kind)) return null

  const stats = await fs.stat(full).catch(() => null)

  if (isNil(stats) || !stats.isFile()) return null

  return { name, rel, kind, sizeBytes: stats.size, mtimeMs: stats.mtimeMs }
}

function resolveSub(root: string, sub: string): string {
  try {
    return resolveInside(root, sub)
  } catch (error) {
    if (error instanceof SafePathError) throw new FolderError(400, error.message)

    throw error
  }
}
