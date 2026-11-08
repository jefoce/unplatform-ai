import 'server-only'

import path from 'node:path'

import { isNil } from 'lodash-es'

import { type ImageOutput, type ImageRecord, ImageRecordSchema } from '@/core/schemas/image-record'

import { removeOwnedFile, writeJsonAtomic } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { imageRecordPath, IMAGES_DIR } from '../paths'
import { type JsonDirChange, jsonDirStore } from './json-dir-store'

const store = jsonDirStore<ImageRecord>({
  key: 'imageIndex',
  dir: IMAGES_DIR,
  fileOf: imageRecordPath,
  schema: ImageRecordSchema,
})

/** Notifies on every image index write. */
export function onImageChange(listener: (change: JsonDirChange) => void): () => void {
  return store.onChange(listener)
}

export async function listImages(): Promise<ImageRecord[]> {
  return store.list()
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  if (!isUuid(id)) {
    return null
  }

  return store.get(id)
}

export async function saveImage(record: ImageRecord): Promise<ImageRecord> {
  const saved: ImageRecord = { ...record, updatedAt: new Date().toISOString() }

  await writeJsonAtomic({ file: imageRecordPath(record.id), data: saved })
  await store.remember(saved)

  return saved
}

/** Absolute path of a saved output, or null for a failed one. */
export function imageOutputFile(output: ImageOutput): string | null {
  if (output.status !== 'saved') {
    return null
  }

  return path.join(IMAGES_DIR, path.basename(output.file))
}

export async function removeImageOutputFile(output: ImageOutput): Promise<void> {
  const file = imageOutputFile(output)

  if (isNil(file)) {
    return
  }

  await removeOwnedFile(file)
}

/** Removes the record json, then every output file, then forgets the index entry. */
export async function deleteImageFiles(id: string): Promise<void> {
  if (!isUuid(id)) {
    return
  }

  const record = await store.get(id)

  const files = (record?.outputs ?? []).map(imageOutputFile).filter((file): file is string => {
    return !isNil(file)
  })

  await removeOwnedFile(imageRecordPath(id))

  try {
    await Promise.all(files.map(removeOwnedFile))
  } finally {
    await store.forget(id)
  }
}
