import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { extWithDot, mimeFromExt } from '@/core/media-kinds'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { type LinkMode, type UploadItem, type UploadsById } from '@/core/schemas/upload-item'
import { inputIds } from '@/core/submit-state'

import { UploadError } from '../errors'
import { removeFile, writeJsonAtomic } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { resolveInside, SafePathError } from '../fs/safe-path'
import { removeEncoded } from '../media/image-cache'
import { downloadPaths, uploadPaths } from '../paths'
import { getFolder } from '../repos/folders'
import { getGeneration } from '../repos/generations'
import { listUploadRecords, loadUploadRecord, rememberUpload } from '../repos/upload-record'
import { deleteUploadFiles, getUpload, saveFileUpload } from '../repos/uploads'
import { getObjectStore } from '../storage/registry'
import { withLock } from '../sync/lock'
import {
  forgetUpload,
  hashPathCached,
  hasSizeCandidate,
  matchByHash,
  rememberUpload as rememberUploadSize,
  runWithHashLock,
} from './upload-hash'
import { assertSupported, probe } from './upload-probe'

interface CreateFileUploadParams {
  bytes: Uint8Array
  originalName: string
}

interface LinkUploadParams {
  absPath: string
  folderId?: string
  relPath?: string
}

/** Reuses an upload with the same bytes, otherwise probes and stores them. */
export async function createFileUpload(params: CreateFileUploadParams): Promise<UploadItem> {
  const { bytes, originalName } = params
  const ext = extWithDot(originalName)
  const kind = assertSupported(ext)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const size = bytes.length

  return runWithHashLock(size, async () => {
    const existing = await matchByHash({ sha256, size })

    if (existing) {
      return existing
    }

    const temp = path.join(os.tmpdir(), `upload-probe-${randomUUID()}${ext}`)

    await fs.writeFile(temp, bytes)

    try {
      const meta = await probe(temp, kind)
      const item = await saveFileUpload({ bytes, originalName, sha256, ...meta })

      rememberUploadSize({ id: item.id, size })

      return item
    } finally {
      await fs.unlink(temp).catch(() => {})
    }
  })
}

/** Links a disk file, falling back to hard link then copy, or reuses an existing link. */
export async function createLinkUpload(params: LinkUploadParams): Promise<UploadItem> {
  const requested = await resolveRequested(params)

  const stats = await fs.stat(requested).catch(() => {
    return null
  })

  if (!stats) {
    throw new UploadError(404, 'File not found')
  }

  if (!stats.isFile()) {
    throw new UploadError(400, 'Not a file')
  }

  const ext = extWithDot(path.basename(requested))
  const kind = assertSupported(ext)
  const mime = mimeFromExt(ext)

  if (!isNonEmptyString(mime)) {
    throw new UploadError(400, `Unsupported file type: ${ext}`)
  }

  const target = await fs.realpath(requested)
  const existing = await findLink(target)

  if (existing) {
    return { ...existing, missing: false }
  }

  const size = stats.size

  return runWithHashLock(size, async () => {
    if (await hasSizeCandidate(size)) {
      const sha256 = await hashPathCached(target)
      const match = await matchByHash({ sha256, size })

      if (match) {
        return match
      }
    }

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
      sizeBytes: size,
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
    rememberUploadSize({ id, size })

    return item
  })
}

/** Loads only uploads referenced by the normalized input. */
export async function loadUploads(input: GenerationInput): Promise<UploadsById> {
  const items = await Promise.all(
    inputIds(input).map((id) => {
      return getUpload(id)
    }),
  )

  return Object.fromEntries(
    items
      .filter((item): item is UploadItem => {
        return !isNil(item)
      })
      .map((item) => {
        return [item.id, item]
      }),
  )
}

/** Symlinks a completed generation's mp4 as a video reference. */
export async function createGenerationLinkUpload(generationId: string): Promise<UploadItem> {
  const record = await getGeneration(generationId)

  if (record?.status !== 'completed') {
    throw new UploadError(404, 'Generation not found')
  }

  const video = downloadPaths(record.id).video

  const stats = await fs.stat(video).catch(() => {
    return null
  })

  if (isNil(stats) || !stats.isFile()) {
    throw new UploadError(404, 'Video file not found')
  }

  return createLinkUpload({ absPath: video })
}

/** Unlinks the media path and json only. A link's target is never touched. */
export async function removeUpload(id: string): Promise<void> {
  if (!isUuid(id)) {
    return
  }

  await withLock(`upload:${id}`, async () => {
    const record = await loadUploadRecord(id)
    let isShared = true

    if (record?.remote) {
      isShared = await sharesRemote(record)
    }

    await deleteUploadFiles({ id, ext: record?.ext ?? '' })
    await removeEncoded(id)

    if (record) {
      forgetUpload({ id, size: record.sizeBytes })
    }

    if (record?.remote && !isShared) {
      await deleteRemote(record.remote.key)
    }
  })
}

async function resolveRequested(params: LinkUploadParams): Promise<string> {
  const { absPath, folderId, relPath } = params

  if (isNonEmptyString(folderId) && isString(relPath)) {
    const folder = await getFolder(folderId)

    if (!folder) {
      throw new UploadError(404, `Folder not found: ${folderId}`)
    }

    try {
      return resolveInside(folder.path, relPath)
    } catch (error) {
      if (error instanceof SafePathError) {
        throw new UploadError(400, error.message)
      }

      throw error
    }
  }

  if (!path.isAbsolute(absPath)) {
    throw new UploadError(400, 'Path must be absolute')
  }

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
    if (record.source !== 'link' || !isNonEmptyString(record.target)) {
      continue
    }

    const real = await fs.realpath(record.target).catch(() => {
      return null
    })

    if (real === target) {
      return record
    }
  }

  return null
}

async function sharesRemote(item: UploadItem): Promise<boolean> {
  const records = await listUploadRecords()

  return records.some((record) => {
    return record.id !== item.id && record.remote?.sha256 === item.remote?.sha256
  })
}

async function deleteRemote(key: string): Promise<void> {
  try {
    await getObjectStore()?.delete(key)
  } catch {
    // Best effort: a failed remote delete must not block local cleanup.
  }
}
