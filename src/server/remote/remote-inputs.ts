import 'server-only'

import fs from 'node:fs/promises'

import { groupBy, isNil } from 'lodash-es'

import { REMOTE_LINK_TTL_SEC, REMOTE_UNUSED_DAYS } from '@/core/constants'
import type { UploadItem } from '@/core/types'

import { globalState } from '../global-state'
import { uploadPaths } from '../paths'
import { listUploads, updateUpload } from '../repos/uploads'
import { secretsReady } from '../secrets'
import { hashFile } from './hash'
import {
  getRemoteStore,
  type RemoteObjectInfo,
  type RemotePutOptions,
  type RemoteStore,
} from './remote-store'

type Remote = NonNullable<UploadItem['remote']>
const puts = globalState('remotePuts', () => new Map<string, Promise<RemoteObjectInfo>>())

interface PutOnceParams {
  store: RemoteStore
  key: string
  file: string
  opts: RemotePutOptions
}

/** Uploads when the object is missing or stale, then refreshes lastUsedAt. */
interface EnsureRemoteParams {
  upload: UploadItem
  onProgress?: (sent: number, total: number) => void
  store?: RemoteStore
}

export async function ensureRemote(params: EnsureRemoteParams): Promise<UploadItem> {
  const { upload, onProgress, store } = params
  const remoteStore = store ?? requireStore()
  const media = uploadPaths(upload.id, upload.ext).media
  const stats = await fs.stat(media)
  const now = new Date().toISOString()
  const prev = upload.remote

  if (prev?.size === stats.size && prev.mtimeMs === stats.mtimeMs) {
    const head = await remoteStore.head(prev.key)

    if (head && sameObject({ head, sha: prev.serverSha256, size: prev.size })) {
      return saveRemote(upload.id, { ...prev, lastUsedAt: now })
    }
  }

  const digest = await hashFile(media)
  const key = `refs/${digest.sha256Hex}${upload.ext}`
  const head = await remoteStore.head(key)

  if (head && sameDigest({ head, digest, prev })) {
    return saveRemote(upload.id, {
      key,
      sha256: digest.sha256Hex,
      serverSha256: head.serverSha256,
      size: digest.size,
      mtimeMs: digest.mtimeMs,
      uploadedAt: now,
      lastUsedAt: now,
    })
  }

  const stored = await putOnce({
    store: remoteStore,
    key,
    file: media,
    opts: {
      contentType: upload.mime,
      sha256: digest.sha256Base64,
      onProgress,
    },
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
  if (!upload.remote) throw new Error(`Upload has no remote object: ${upload.id}`)

  return requireStore().presign({
    key: upload.remote.key,
    ttlSec: linkTtlSec(),
    contentType: upload.mime,
  })
}

/** Deletes objects whose uploads all passed REMOTE_UNUSED_DAYS, clears their remote. */
export async function sweepRemote(
  store?: RemoteStore,
): Promise<{ deleted: number; cleared: number }> {
  await secretsReady()
  const remoteStore = store ?? getRemoteStore()

  if (!remoteStore) return { deleted: 0, cleared: 0 }

  const uploads = await listUploads()
  const withRemote = uploads.filter((item): item is UploadItem & { remote: Remote } =>
    Boolean(item.remote),
  )
  const groups = groupBy(withRemote, (item) => item.remote.key)
  const cutoff = Date.now() - REMOTE_UNUSED_DAYS * 86_400_000
  let deleted = 0
  let cleared = 0

  for (const items of Object.values(groups)) {
    if (items.some((item) => Date.parse(item.remote.lastUsedAt) >= cutoff)) continue

    await remoteStore.delete(items[0].remote.key)
    deleted += 1

    for (const item of items) {
      const saved = await updateUpload(item.id, (current) => ({ ...current, remote: undefined }))

      if (saved) cleared += 1
    }
  }

  return { deleted, cleared }
}

/** One put per key at a time. Later callers wait for the first. */
export function putOnce(params: PutOnceParams): Promise<RemoteObjectInfo> {
  const { store, key, file, opts } = params
  const running = puts.get(key)

  if (running) return running

  const job = store.put({ key, file, opts }).finally(() => puts.delete(key))

  puts.set(key, job)

  return job
}

async function saveRemote(id: string, remote: Remote): Promise<UploadItem> {
  const saved = await updateUpload(id, (item) => ({ ...item, remote }))

  if (!saved) throw new Error('Input file was removed during upload')

  return saved
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

  if (head.size !== size) return false

  if (isNil(head.serverSha256)) return isNil(sha)

  return head.serverSha256 === sha
}

interface SameDigestParams {
  head: RemoteHead
  digest: { sha256Hex: string; sha256Base64: string; size: number }
  prev?: Remote
}

function sameDigest(params: SameDigestParams): boolean {
  const { head, digest, prev } = params

  if (head.size !== digest.size) return false

  if (isNil(head.serverSha256)) return true

  if (head.serverSha256 === digest.sha256Base64) return true

  return prev?.sha256 === digest.sha256Hex && head.serverSha256 === prev.serverSha256
}

function requireStore(): RemoteStore {
  const store = getRemoteStore()

  if (!store) throw new Error('Remote storage is not configured')

  return store
}

function linkTtlSec(): number {
  const value = Number(process.env.REMOTE_LINK_TTL_SEC)

  return Number.isFinite(value) && value > 0 ? value : REMOTE_LINK_TTL_SEC
}
