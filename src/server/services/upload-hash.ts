import 'server-only'

import fs from 'node:fs/promises'

import { isEmpty, isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { UploadItem } from '@/core/schemas/upload-item'

import { globalState } from '../global-state'
import { uploadPaths, UPLOADS_DIR } from '../paths'
import { listUploadRecords, loadUploadRecord, updateUpload } from '../repos/upload-record'
import { uploadExists } from '../repos/uploads'
import { hashFile } from '../storage/hash'
import { withLock } from '../sync/lock'

interface SizeIndex {
  sizes: Map<number, Set<string>>
  ready: Promise<void> | null
}

interface PathHashEntry {
  size: number
  mtimeMs: number
  sha256: string
}

interface MatchByHashParams {
  sha256: string
  size: number
}

interface UploadSizeParams {
  id: string
  size: number
}

interface DigestEntry {
  item: UploadItem
  sha256: string
}

interface AddSizeParams {
  sizes: Map<number, Set<string>>
  size: number
  id: string
}

const pathHashes = globalState<Map<string, PathHashEntry>>('uploadPathHashes', () => {
  return new Map()
})

function getIndex(): SizeIndex {
  return globalState<SizeIndex>(`uploadSizes:${UPLOADS_DIR}`, () => {
    return { sizes: new Map(), ready: null }
  })
}

function addSize(params: AddSizeParams): void {
  const { sizes, size, id } = params
  const ids = sizes.get(size) ?? new Set<string>()

  ids.add(id)
  sizes.set(size, ids)
}

/** Buckets every record by size. Reads json only, never media. */
async function buildSizes(): Promise<void> {
  const index = getIndex()
  const records = await listUploadRecords()

  for (const record of records) {
    addSize({ sizes: index.sizes, size: record.sizeBytes, id: record.id })
  }
}

async function ensureSizes(): Promise<SizeIndex> {
  const index = getIndex()

  index.ready ??= buildSizes().catch((error: unknown) => {
    index.ready = null

    throw error
  })

  await index.ready

  return index
}

/** True when the size bucket holds at least one record. */
export async function hasSizeCandidate(size: number): Promise<boolean> {
  const index = await ensureSizes()

  return !isEmpty(index.sizes.get(size))
}

/** Returns the live upload with this digest, hashing each size candidate once. */
export async function matchByHash(params: MatchByHashParams): Promise<UploadItem | null> {
  const { sha256, size } = params
  const index = await ensureSizes()
  const ids = index.sizes.get(size)

  if (isNil(ids) || isEmpty(ids)) {
    return null
  }

  for (const id of ids) {
    const record = await loadUploadRecord(id)

    if (isNil(record) || !(await uploadExists(record))) {
      ids.delete(id)

      continue
    }

    const candidate = await digestOf(record)

    if (candidate.sha256 === sha256) {
      return { ...candidate.item, missing: false }
    }
  }

  return null
}

/** Adds an id to its size bucket. The digest lives on the record. */
export function rememberUpload(params: UploadSizeParams): void {
  const { id, size } = params

  addSize({ sizes: getIndex().sizes, size, id })
}

/** Drops an id from its size bucket. */
export function forgetUpload(params: UploadSizeParams): void {
  const { id, size } = params

  getIndex().sizes.get(size)?.delete(id)
}

/** Reuses the digest while the file's size and mtime stay the same. */
export async function hashPathCached(file: string): Promise<string> {
  const stats = await fs.stat(file)
  const cached = pathHashes.get(file)

  if (cached?.size === stats.size && cached.mtimeMs === stats.mtimeMs) {
    return cached.sha256
  }

  const digest = await hashFile(file)

  pathHashes.set(file, {
    size: digest.size,
    mtimeMs: digest.mtimeMs,
    sha256: digest.sha256Hex,
  })

  return digest.sha256Hex
}

/** Serializes work per size so two uploads of the same bytes cannot race. */
export function runWithHashLock<T>(size: number, task: () => Promise<T>): Promise<T> {
  return withLock(`uploadSize:${size}`, task)
}

async function digestOf(record: UploadItem): Promise<DigestEntry> {
  if (isNonEmptyString(record.sha256)) {
    return { item: record, sha256: record.sha256 }
  }

  const sha256 = await hashPathCached(mediaPathOf(record))

  const saved = await updateUpload(record.id, (current) => {
    return { ...current, sha256 }
  })

  return { item: saved ?? { ...record, sha256 }, sha256 }
}

/** Follows a symlink target. Hard links and copies live in the media path. */
function mediaPathOf(record: UploadItem): string {
  const mode = record.linkMode ?? 'symlink'

  if (record.source === 'link' && isNonEmptyString(record.target) && mode === 'symlink') {
    return record.target
  }

  return uploadPaths(record.id, record.ext).media
}
