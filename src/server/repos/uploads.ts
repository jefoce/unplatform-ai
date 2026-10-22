import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

import { filter, isNil, orderBy } from 'lodash-es'

import { extWithDot, mimeFromExt } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'

import { removeFile, writeJsonAtomic } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { withLock } from '../jobs/lock'
import { removeEncoded } from '../media/image-cache'
import { uploadPaths, UPLOADS_DIR } from '../paths'
import { getRemoteStore } from '../remote/remote-store'
import { assertSupported, probe, UploadError } from './upload-meta'
import {
  forgetUpload,
  getUploadRecord,
  jsonPath,
  listUploadRecords,
  loadUploadRecord,
  rememberUpload,
} from './upload-record'

export { createGenerationLinkUpload, createLinkUpload } from './upload-links'
export { UploadError } from './upload-meta'
export { saveUploadItem, updateUpload } from './upload-record'

interface SaveFileUploadParams {
  bytes: Uint8Array
  originalName: string
  mime?: string
}

interface ListUploadsParams {
  kinds?: MediaKind[]
  ids?: string[]
}

/** Copies bytes into uploads/ and writes the json record last. */
export async function saveFileUpload(params: SaveFileUploadParams): Promise<UploadItem> {
  const { bytes, originalName } = params
  const ext = extWithDot(originalName)
  const kind = assertSupported(ext)
  const mime = mimeFromExt(ext)

  if (isNil(mime) || mime === '') throw new UploadError(400, `Unsupported file type: ${ext}`)

  const id = randomUUID()
  const paths = uploadPaths(id, ext)

  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  await fs.writeFile(paths.media, bytes)

  const item: UploadItem = {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName,
    sizeBytes: bytes.length,
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

export async function listUploads(params: ListUploadsParams = {}): Promise<UploadItem[]> {
  const { kinds, ids } = params
  let records = await listUploadRecords()

  if (!isNil(kinds) && kinds.length > 0)
    records = filter(records, (record) => kinds.includes(record.kind))

  if (!isNil(ids) && ids.length > 0) records = filter(records, (record) => ids.includes(record.id))

  const sorted = orderBy(records, ['createdAt'], ['desc'])

  return Promise.all(sorted.map(withMissing))
}

export async function getUpload(id: string): Promise<UploadItem | null> {
  const record = await getUploadRecord(id)

  return record ? withMissing(record) : null
}

/** Unlinks the media path and json only. A link's target is never touched. */
export async function removeUpload(id: string): Promise<void> {
  if (!isUuid(id)) return

  await withLock(`upload:${id}`, async () => {
    const record = await loadUploadRecord(id)
    let isShared = true

    if (record?.remote) isShared = await sharesRemote(record)

    if (record) await removeFile(uploadPaths(id, record.ext).media)

    await removeFile(jsonPath(id))
    await removeEncoded(id)
    await forgetUpload(id)

    if (record?.remote && !isShared) await deleteRemote(record.remote.key)
  })
}

async function sharesRemote(item: UploadItem): Promise<boolean> {
  const records = await listUploadRecords()

  return records.some(
    (record) => record.id !== item.id && record.remote?.sha256 === item.remote?.sha256,
  )
}

async function deleteRemote(key: string): Promise<void> {
  try {
    await getRemoteStore()?.delete(key)
  } catch {
    // Best effort: a failed remote delete must not block local cleanup.
  }
}

async function pathExists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => true,
    () => false,
  )
}

async function withMissing(item: UploadItem): Promise<UploadItem> {
  const mode = item.linkMode ?? 'symlink'
  const check =
    item.source === 'link' && !isNil(item.target) && item.target !== '' && mode === 'symlink'
      ? item.target
      : uploadPaths(item.id, item.ext).media
  const hasFile = await pathExists(check)

  return { ...item, missing: !hasFile }
}
