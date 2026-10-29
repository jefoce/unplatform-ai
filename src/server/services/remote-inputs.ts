import 'server-only'

import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'

import { REMOTE_LINK_TTL_SEC, REMOTE_REFRESH_DAYS, REMOTE_UNUSED_DAYS } from '@/core/constants'
import type { UploadItem, UploadRemote } from '@/core/schemas/upload-item'

import { globalState } from '../global-state'
import { uploadPaths } from '../paths'
import { listUploadRecords, updateUpload } from '../repos/upload-record'
import { secretsReady } from '../secrets'
import { type FileHash, hashFile } from '../storage/hash'
import { getObjectStore } from '../storage/registry'
import type { ObjectInfo, ObjectStore, ProgressCallback } from '../storage/types'
import { withLock } from '../sync/lock'
import { deleteOrphans, deleteRemoteGroup, makeRoom, remoteKeyGroups } from './remote-cap'

interface SweepResult {
  deleted: number
  cleared: number
}

const puts = globalState('remotePuts', () => {
  return new Map<string, Promise<ObjectInfo>>()
})

interface PutObjectOptions {
  contentType: string
  sha256: string
  onProgress?: ProgressCallback
}

interface PutOnceParams {
  store: ObjectStore
  key: string
  file: string
  opts: PutObjectOptions
}

/** Uploads when the object is missing or stale, then refreshes lastUsedAt. */
interface EnsureRemoteParams {
  upload: UploadItem
  onProgress?: ProgressCallback
  store?: ObjectStore
}

export async function ensureRemote(params: EnsureRemoteParams): Promise<UploadItem> {
  const { upload, onProgress, store } = params
  const remoteStore = store ?? requireStore()
  const media = uploadPaths(upload.id, upload.ext).media
  const stats = await fs.stat(media)
  const now = new Date().toISOString()
  const prev = upload.remote
  const refreshCutoff = Date.now() - REMOTE_REFRESH_DAYS * 86_400_000
  let firstHead: ObjectInfo | null = null
  let hasFirstHead = false

  if (prev?.size === stats.size && prev.mtimeMs === stats.mtimeMs) {
    firstHead = await remoteStore.head(prev.key)
    hasFirstHead = true

    const reusable = freshHead({
      head: firstHead,
      cutoff: refreshCutoff,
      check: (headInfo) => {
        return sameObject({ head: headInfo, sha: prev.serverSha256, size: prev.size })
      },
    })

    if (reusable) {
      return saveRemote(upload.id, { ...prev, lastUsedAt: now })
    }
  }

  const digest = await hashFile(media)
  const key = `refs/${digest.sha256Hex}${upload.ext}`
  let head = firstHead

  if (!hasFirstHead || key !== prev?.key) {
    head = await remoteStore.head(key)
  }

  const reusableHead = freshHead({
    head,
    cutoff: refreshCutoff,
    check: (headInfo) => {
      return sameDigest({ head: headInfo, digest, prev })
    },
  })

  if (reusableHead) {
    return saveRemote(upload.id, {
      key,
      sha256: digest.sha256Hex,
      serverSha256: reusableHead.serverSha256,
      size: digest.size,
      mtimeMs: digest.mtimeMs,
      uploadedAt: now,
      lastUsedAt: now,
    })
  }

  const stored = await withLock('remoteCap', async () => {
    await makeRoom({ store: remoteStore, bytes: digest.size, keepKey: key })

    return putOnce({
      store: remoteStore,
      key,
      file: media,
      opts: {
        contentType: upload.mime,
        sha256: digest.sha256Base64,
        onProgress,
      },
    })
  })

  return saveRemote(upload.id, {
    key,
    sha256: digest.sha256Hex,
    serverSha256: stored.serverSha256,
    size: digest.size,
    mtimeMs: digest.mtimeMs,
    uploadedAt: now,
    lastUsedAt: now,
  })
}

/** Returns a short-lived private link. Never persist the result. */
export async function presignFor(upload: UploadItem): Promise<string> {
  if (!upload.remote) {
    throw new Error(`Upload has no remote object: ${upload.id}`)
  }

  return requireStore().presign({
    key: upload.remote.key,
    ttlSec: REMOTE_LINK_TTL_SEC,
    contentType: upload.mime,
  })
}

/** Deletes objects whose uploads all passed REMOTE_UNUSED_DAYS, clears their remote. */
export async function sweepRemote(store?: ObjectStore): Promise<SweepResult> {
  await secretsReady()
  const remoteStore = store ?? getObjectStore()

  if (!remoteStore) {
    return { deleted: 0, cleared: 0 }
  }

  const uploads = await listUploadRecords()
  const groups = remoteKeyGroups(uploads)

  const cutoff = Date.now() - REMOTE_UNUSED_DAYS * 86_400_000
  const swept = new Set<string>()
  let deleted = 0
  let cleared = 0

  for (const items of Object.values(groups)) {
    const [first] = items

    if (
      isNil(first) ||
      items.some((item) => {
        return Date.parse(item.remote.lastUsedAt) >= cutoff
      })
    ) {
      continue
    }

    const result = await deleteRemoteGroup(remoteStore, items)

    swept.add(first.remote.key)
    deleted += result.deleted
    cleared += result.cleared
  }

  const referenced = new Set(
    Object.keys(groups).filter((key) => {
      return !swept.has(key)
    }),
  )

  const orphans = await deleteOrphans({ store: remoteStore, referenced, skip: swept })

  deleted += orphans.count

  return { deleted, cleared }
}

/** One put per key at a time. Callers must HEAD first because a put overwrites by key. */
export function putOnce(params: PutOnceParams): Promise<ObjectInfo> {
  const { store, key, file, opts } = params
  const running = puts.get(key)

  if (running) {
    return running
  }

  const job = store
    .put({
      key,
      file,
      contentType: opts.contentType,
      sha256: opts.sha256,
      onProgress: opts.onProgress ?? null,
    })
    .finally(() => {
      puts.delete(key)
    })

  puts.set(key, job)

  return job
}

async function saveRemote(id: string, remote: UploadRemote): Promise<UploadItem> {
  const saved = await updateUpload(id, (item) => {
    return { ...item, remote }
  })

  if (!saved) {
    throw new Error('Input file was removed during upload')
  }

  return saved
}

interface FreshObjectParams {
  head: ObjectInfo | null
  cutoff: number
  check: (head: ObjectInfo) => boolean
}

function freshHead(params: FreshObjectParams): ObjectInfo | null {
  const { head, cutoff, check } = params

  if (isNil(head)) {
    return null
  }

  if (head.lastModified < cutoff || !check(head)) {
    return null
  }

  return head
}

interface RemoteHead {
  size: number
  serverSha256: string | null
}

interface SameObjectParams {
  head: RemoteHead
  sha: string | null
  size: number
}

function sameObject(params: SameObjectParams): boolean {
  const { head, sha, size } = params

  if (head.size !== size) {
    return false
  }

  if (isNil(head.serverSha256)) {
    return isNil(sha)
  }

  return head.serverSha256 === sha
}

interface SameDigestParams {
  head: RemoteHead
  digest: FileHash
  prev?: UploadRemote
}

function sameDigest(params: SameDigestParams): boolean {
  const { head, digest, prev } = params

  if (head.size !== digest.size) {
    return false
  }

  if (isNil(head.serverSha256)) {
    return true
  }

  if (head.serverSha256 === digest.sha256Base64) {
    return true
  }

  return prev?.sha256 === digest.sha256Hex && head.serverSha256 === prev.serverSha256
}

function requireStore(): ObjectStore {
  const store = getObjectStore()

  if (!store) {
    throw new Error('Remote storage is not configured')
  }

  return store
}
