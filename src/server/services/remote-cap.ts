import 'server-only'

import { groupBy, isNil, sortBy, sumBy } from 'lodash-es'

import { REMOTE_LINK_TTL_SEC, REMOTE_MAX_GB } from '@/core/constants'
import type { UploadItem, UploadRemote } from '@/core/schemas/upload-item'

import { RemoteCapError } from '../errors'
import { updateUpload } from '../repos/upload-record'
import { listUploads } from '../repos/uploads'
import type { ObjectStore } from '../storage/types'

interface RemoteUpload extends UploadItem {
  remote: UploadRemote
}

interface MakeRoomParams {
  store: ObjectStore
  bytes: number
  keepKey: string
}

interface DeleteRemoteResult {
  deleted: number
  cleared: number
}

const CAP_BYTES = REMOTE_MAX_GB * 1024 ** 3

/** Uploads that still have a remote object, grouped by key. */
export function remoteKeyGroups(uploads: UploadItem[]): Record<string, RemoteUpload[]> {
  const withRemote = uploads.filter((item): item is RemoteUpload => {
    return Boolean(item.remote)
  })

  return groupBy(withRemote, (item) => {
    return item.remote.key
  })
}

/** Sum of remote sizes, one per distinct key. */
export function trackedRemoteBytes(uploads: UploadItem[]): number {
  return sumBy(Object.values(remoteKeyGroups(uploads)), (items) => {
    const [first] = items

    if (isNil(first)) {
      return 0
    }

    return first.remote.size
  })
}

/** Deletes the oldest expired keys until the new object fits under the cap. */
export async function makeRoom(params: MakeRoomParams): Promise<void> {
  const { store, bytes, keepKey } = params
  // No lock: two parallel uploads may both pass, the 2 GB headroom covers it.
  const uploads = await listUploads()
  let tracked = trackedRemoteBytes(uploads)

  if (tracked + bytes <= CAP_BYTES) {
    return
  }

  const cutoff = Date.now() - REMOTE_LINK_TTL_SEC * 1000

  const candidates = Object.values(remoteKeyGroups(uploads)).filter((items) => {
    const [first] = items

    return (
      !isNil(first) &&
      first.remote.key !== keepKey &&
      items.every((item) => {
        return Date.parse(item.remote.lastUsedAt) < cutoff
      })
    )
  })

  const ordered = sortBy(candidates, newestUsedAt)

  for (const items of ordered) {
    if (tracked + bytes <= CAP_BYTES) {
      return
    }

    const [first] = items

    if (isNil(first)) {
      continue
    }

    await deleteRemoteGroup(store, items)
    tracked -= first.remote.size
  }

  if (tracked + bytes > CAP_BYTES) {
    throw new RemoteCapError()
  }
}

/** Deletes one key's object and clears every upload record that shares it. */
export async function deleteRemoteGroup(
  store: ObjectStore,
  items: RemoteUpload[],
): Promise<DeleteRemoteResult> {
  const [first] = items

  if (isNil(first)) {
    return { deleted: 0, cleared: 0 }
  }

  await store.delete(first.remote.key)
  let cleared = 0

  for (const item of items) {
    const saved = await updateUpload(item.id, (current) => {
      return { ...current, remote: undefined }
    })

    if (saved) {
      cleared += 1
    }
  }

  return { deleted: 1, cleared }
}

function newestUsedAt(items: RemoteUpload[]): number {
  return Math.max(
    ...items.map((item) => {
      return Date.parse(item.remote.lastUsedAt)
    }),
  )
}
