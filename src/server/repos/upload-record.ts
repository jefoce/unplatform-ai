import 'server-only'

import path from 'node:path'

import type { UploadItem } from '@/core/types'

import { readJson, writeJsonAtomic } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { withLock } from '../jobs/lock'
import { UPLOADS_DIR } from '../paths'
import { jsonDirStore } from './json-dir-store'

const store = jsonDirStore<UploadItem>({
  key: 'uploadIndex',
  dir: UPLOADS_DIR,
  fileOf: jsonPath,
})

export function jsonPath(id: string): string {
  return path.join(UPLOADS_DIR, `${id}.json`)
}

export async function listUploadRecords(): Promise<UploadItem[]> {
  return store.list()
}

export async function getUploadRecord(id: string): Promise<UploadItem | null> {
  if (!isUuid(id)) return null

  return store.get(id)
}

export async function loadUploadRecord(id: string): Promise<UploadItem | null> {
  return readJson<UploadItem>(jsonPath(id))
}

/** Writes the upload record atomically and returns it unchanged. */
export async function saveUploadItem(item: UploadItem): Promise<UploadItem> {
  await writeJsonAtomic({ file: jsonPath(item.id), data: item })

  return rememberUpload(item)
}

export async function rememberUpload(item: UploadItem): Promise<UploadItem> {
  await store.remember(item)

  return item
}

export async function forgetUpload(id: string): Promise<void> {
  await store.forget(id)
}

/** Patches an upload under its lock. Null when it was removed meanwhile. */
export async function updateUpload(
  id: string,
  patch: (item: UploadItem) => UploadItem,
): Promise<UploadItem | null> {
  if (!isUuid(id)) return null

  return withLock(`upload:${id}`, async () => {
    const current = await loadUploadRecord(id)

    return current ? saveUploadItem(patch(current)) : null
  })
}
