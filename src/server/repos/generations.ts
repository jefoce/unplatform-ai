import 'server-only'

import { type GenerationRecord, GenerationRecordSchema } from '@/core/schemas/generation-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { removeOwnedFile, writeJsonAtomic } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { downloadPaths, DOWNLOADS_DIR } from '../paths'
import { jsonDirStore } from './json-dir-store'

const store = jsonDirStore<GenerationRecord>({
  key: 'generationIndex',
  dir: DOWNLOADS_DIR,
  fileOf: (id) => {
    return downloadPaths(id).json
  },
  schema: GenerationRecordSchema,
})

/** Reads every record once, reloading when the downloads directory changes. */
export async function listGenerations(): Promise<GenerationRecord[]> {
  return store.list()
}

export async function getGeneration(id: string): Promise<GenerationRecord | null> {
  if (!isUuid(id)) {
    return null
  }

  return store.get(id)
}

export async function saveGeneration(record: GenerationRecord): Promise<GenerationRecord> {
  const saved: GenerationRecord = { ...record, updatedAt: new Date().toISOString() }

  await writeJsonAtomic({ file: downloadPaths(record.id).json, data: saved })
  await store.remember(saved)

  return saved
}

/** Removes only the generation's own json, video, preview and partial files. */
export async function deleteGenerationFiles(id: string): Promise<void> {
  if (!isUuid(id)) {
    return
  }

  const paths = downloadPaths(id)

  await Promise.all([
    removeOwnedFile(paths.json),
    removeOwnedFile(paths.video),
    removeOwnedFile(paths.preview),
    removeOwnedFile(paths.part),
  ])

  await store.forget(id)
}

export async function listActiveGenerations(): Promise<GenerationRecord[]> {
  const records = await listGenerations()

  return records.filter((record) => {
    return ACTIVE_STATUSES.includes(record.status)
  })
}

export async function getActiveCount(): Promise<number> {
  const active = await listActiveGenerations()

  return active.length
}
