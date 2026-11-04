import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

import { filter, isNil, orderBy } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { extWithDot, kindFromExt, mimeFromExt } from '@/core/media/media-kinds'
import type { MediaKind } from '@/core/media/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

import { UploadError } from '../errors'
import { commitFile } from '../fs/atomic-file'
import { removeFile, removeOwnedFile, writeJsonAtomic } from '../fs/json-file'
import { uploadPaths, UPLOADS_DIR } from '../paths'
import { forgetUpload, getUploadRecord, listUploadRecords, rememberUpload } from './upload-record'

interface SaveFileUploadParams {
  bytes: Uint8Array
  originalName: string
  sha256: string
  width?: number
  height?: number
  durationSec?: number
}

interface ListUploadsParams {
  kinds?: MediaKind[]
  ids?: string[]
}

interface DeleteUploadFilesParams {
  id: string
  ext: string
}

/** Copies bytes into uploads/ and writes the json record last. */
export async function saveFileUpload(params: SaveFileUploadParams): Promise<UploadItem> {
  const { bytes, originalName, sha256, width, height, durationSec } = params
  const ext = extWithDot(originalName)
  const kind = kindFromExt(ext)
  const mime = mimeFromExt(ext)

  if (isNil(kind)) {
    throw new UploadError(400, `Unsupported file type: ${ext}`)
  }

  if (!isNonEmptyString(mime)) {
    throw new UploadError(400, `Unsupported file type: ${ext}`)
  }

  const id = randomUUID()
  const paths = uploadPaths(id, ext)

  await fs.mkdir(UPLOADS_DIR, { recursive: true })

  const temp = `${paths.media}.tmp-${randomUUID()}`

  await fs.writeFile(temp, bytes)

  try {
    await commitFile({ temp, target: paths.media })
  } catch (error) {
    await removeFile(temp)

    throw error
  }

  const item: UploadItem = {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName,
    sizeBytes: bytes.length,
    sha256,
    width,
    height,
    durationSec,
    createdAt: new Date().toISOString(),
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

interface SaveStagedUploadParams {
  temp: string
  originalName: string
  sha256: string
  sizeBytes: number
  width?: number
  height?: number
  durationSec?: number
}

/** Moves an already-written temp file into uploads/ and writes the json record last. */
export async function saveStagedUpload(params: SaveStagedUploadParams): Promise<UploadItem> {
  const { temp, originalName, sha256, sizeBytes, width, height, durationSec } = params
  const ext = extWithDot(originalName)
  const kind = kindFromExt(ext)
  const mime = mimeFromExt(ext)

  if (isNil(kind) || !isNonEmptyString(mime)) {
    throw new UploadError(400, `Unsupported file type: ${ext}`)
  }

  const id = randomUUID()
  const paths = uploadPaths(id, ext)

  await fs.mkdir(UPLOADS_DIR, { recursive: true })

  try {
    await commitFile({ temp, target: paths.media })
  } catch (error) {
    await removeFile(temp)

    throw error
  }

  const item: UploadItem = {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName,
    sizeBytes,
    sha256,
    width,
    height,
    durationSec,
    createdAt: new Date().toISOString(),
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

export async function listUploads(params: ListUploadsParams = {}): Promise<UploadItem[]> {
  const { kinds, ids } = params
  let records = await listUploadRecords()

  if (!isNil(kinds) && kinds.length > 0) {
    records = filter(records, (record) => {
      return kinds.includes(record.kind)
    })
  }

  if (!isNil(ids) && ids.length > 0) {
    records = filter(records, (record) => {
      return ids.includes(record.id)
    })
  }

  const sorted = orderBy(records, ['createdAt'], ['desc'])

  return Promise.all(sorted.map(withMissing))
}

export async function getUpload(id: string): Promise<UploadItem | null> {
  const record = await getUploadRecord(id)

  if (record) {
    return withMissing(record)
  }

  return null
}

/** Unlinks the media file and the json, then forgets the index entry. */
export async function deleteUploadFiles(params: DeleteUploadFilesParams): Promise<void> {
  const { id, ext } = params
  const paths = uploadPaths(id, ext)

  if (isNonEmptyString(ext)) {
    await removeOwnedFile(paths.media)
  }

  await removeOwnedFile(paths.json)
  await forgetUpload(id)
}

async function pathExists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

/** A link symlink is only as alive as its target. Every other upload uses its media path. */
export async function uploadExists(item: UploadItem): Promise<boolean> {
  const mode = item.linkMode ?? 'symlink'

  let check = uploadPaths(item.id, item.ext).media

  if (item.source === 'link' && isNonEmptyString(item.target) && mode === 'symlink') {
    check = item.target
  }

  return pathExists(check)
}

async function withMissing(item: UploadItem): Promise<UploadItem> {
  const hasFile = await uploadExists(item)

  return { ...item, missing: !hasFile }
}
