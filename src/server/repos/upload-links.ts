import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'

import { extWithDot, mimeFromExt } from '@/core/media-kinds'
import type { LinkMode, UploadItem } from '@/core/types'

import { removeFile, writeJsonAtomic } from '../fs/json-file'
import { resolveInside, SafePathError } from '../fs/safe-path'
import { downloadPaths, uploadPaths } from '../paths'
import { getFolder } from './folders'
import { getGeneration } from './generations'
import { assertSupported, probe, UploadError } from './upload-meta'
import { listUploadRecords, rememberUpload } from './upload-record'

interface LinkUploadParams {
  absPath: string
  folderId?: string
  relPath?: string
}

/** Links a disk file, falling back to hard link then copy, or reuses an existing link. */
export async function createLinkUpload(params: LinkUploadParams): Promise<UploadItem> {
  const requested = await resolveRequested(params)
  const stats = await fs.stat(requested).catch(() => null)

  if (!stats) throw new UploadError(404, 'File not found')

  if (!stats.isFile()) throw new UploadError(400, 'Not a file')

  const ext = extWithDot(path.basename(requested))
  const kind = assertSupported(ext)
  const mime = mimeFromExt(ext)

  if (isNil(mime) || mime === '') throw new UploadError(400, `Unsupported file type: ${ext}`)

  const target = await fs.realpath(requested)
  const existing = await findLink(target)

  if (existing) return { ...existing, missing: false }

  const id = randomUUID()
  const paths = uploadPaths(id, ext)
  const linkMode = await linkOrCopy(target, paths.media)

  const item: UploadItem = {
    id,
    source: 'link',
    kind,
    mime,
    ext,
    originalName: path.basename(requested),
    target,
    linkMode,
    sizeBytes: stats.size,
    createdAt: new Date().toISOString(),
    ...(await probe(paths.media, kind)),
  }

  try {
    await writeJsonAtomic({ file: paths.json, data: item })
  } catch (error) {
    await removeFile(paths.media)

    throw error
  }

  await rememberUpload(item)

  return item
}

/** Symlinks a completed generation's mp4 as a video reference. */
export async function createGenerationLinkUpload(generationId: string): Promise<UploadItem> {
  const record = await getGeneration(generationId)

  if (record?.status !== 'completed') throw new UploadError(404, 'Generation not found')

  const video = downloadPaths(record.id).video
  const stats = await fs.stat(video).catch(() => null)

  if (isNil(stats) || !stats.isFile()) throw new UploadError(404, 'Video file not found')

  return createLinkUpload({ absPath: video })
}

async function resolveRequested(params: LinkUploadParams): Promise<string> {
  const { absPath, folderId, relPath } = params

  if (!isNil(folderId) && folderId !== '' && isString(relPath)) {
    const folder = await getFolder(folderId)

    if (!folder) throw new UploadError(404, `Folder not found: ${folderId}`)

    try {
      return resolveInside(folder.path, relPath)
    } catch (error) {
      if (error instanceof SafePathError) throw new UploadError(400, error.message)

      throw error
    }
  }

  if (!path.isAbsolute(absPath)) throw new UploadError(400, 'Path must be absolute')

  return absPath
}

/** Symlink first, then hard link, then copy. Windows often denies symlinks. */
async function linkOrCopy(target: string, media: string): Promise<LinkMode> {
  try {
    await fs.symlink(target, media, 'file')

    return 'symlink'
  } catch {
    // EPERM without Developer Mode or EXDEV across volumes.
  }

  try {
    await fs.link(target, media)

    return 'hardlink'
  } catch {
    await fs.copyFile(target, media)

    return 'copy'
  }
}

async function findLink(target: string): Promise<UploadItem | null> {
  const records = await listUploadRecords()

  for (const record of records) {
    if (record.source !== 'link' || isNil(record.target) || record.target === '') continue

    const real = await fs.realpath(record.target).catch(() => null)

    if (real === target) return record
  }

  return null
}
