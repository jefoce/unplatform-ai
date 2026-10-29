import 'server-only'

import { groupBy, isNil, sortBy, sum, sumBy } from 'lodash-es'

import { REMOTE_LINK_TTL_SEC, REMOTE_MAX_GB } from '@/core/constants'
import type { UploadItem, UploadRemote } from '@/core/schemas/upload-item'

import { RemoteCapError } from '../errors'
import { listUploadRecords, updateUpload } from '../repos/upload-record'
import type { ListedObject, ObjectStore } from '../storage/types'

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

export interface DeleteOrphansParams {
  store: ObjectStore
  objects?: ListedObject[]
  referenced: Set<string>
  skip?: Set<string>
  total?: number
  targetBytes?: number
}

export interface DeletedOrphans {
  count: number
  bytes: number
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
  const uploads = await listUploadRecords()
  const objects = await listRefs(store)
  const listing = sizeByKey(objects)
  let tracked = currentBytes(listing, uploads)

  if (tracked + bytes <= CAP_BYTES) {
    return
  }

  if (!isNil(objects)) {
    const orphans = await deleteOrphans({
      store,
      objects,
      referenced: new Set(Object.keys(remoteKeyGroups(uploads))),
      skip: new Set([keepKey]),
      total: tracked,
      targetBytes: CAP_BYTES - bytes,
    })

    tracked -= orphans.bytes

    if (tracked + bytes <= CAP_BYTES) {
      return
    }
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
    tracked -= evictedBytes(listing, first)
  }

  if (tracked + bytes > CAP_BYTES) {
    throw new RemoteCapError()
  }
}

/**
 * Deletes refs/ objects no record points at, older than the link TTL.
 * Stops once the running total reaches targetBytes, oldest first.
 */
export async function deleteOrphans(params: DeleteOrphansParams): Promise<DeletedOrphans> {
  const { store, objects, referenced, skip = new Set(), total = 0, targetBytes } = params
  const eligible = await collectOrphans({ store, objects, referenced, skip })

  const ordered = sortBy(eligible, (object) => {
    return object.lastModified
  })

  return deleteCollected({ store, objects: ordered, total, targetBytes })
}

interface CollectOrphansParams {
  store: ObjectStore
  objects?: ListedObject[]
  referenced: Set<string>
  skip: Set<string>
}

/** Eligible refs/ objects. A listing failure keeps the objects already read. */
async function collectOrphans(params: CollectOrphansParams): Promise<ListedObject[]> {
  const { store, objects, referenced, skip } = params

  if (!isNil(objects)) {
    return filterOrphans({ objects, referenced, skip })
  }

  const list = store.list?.bind(store)

  if (isNil(list)) {
    return []
  }

  const listed: ListedObject[] = []

  try {
    for await (const object of list('refs/')) {
      listed.push(object)
    }
  } catch {
    // A failed listing still processes the objects it returned.
  }

  return filterOrphans({ objects: listed, referenced, skip })
}

interface FilterOrphansParams {
  objects: ListedObject[]
  referenced: Set<string>
  skip: Set<string>
}

/** Applies the referenced, skip and link TTL rules to a listed set. */
function filterOrphans(params: FilterOrphansParams): ListedObject[] {
  const { objects, referenced, skip } = params
  const cutoff = Date.now() - REMOTE_LINK_TTL_SEC * 1000

  return objects.filter((object) => {
    if (referenced.has(object.key) || skip.has(object.key)) {
      return false
    }

    return object.lastModified <= cutoff
  })
}

interface DeleteCollectedParams {
  store: ObjectStore
  objects: ListedObject[]
  total: number
  targetBytes?: number
}

/** Deletes eligible objects until the running total reaches the target. */
async function deleteCollected(params: DeleteCollectedParams): Promise<DeletedOrphans> {
  const { store, objects, total, targetBytes } = params
  let count = 0
  let bytes = 0

  for (const object of objects) {
    if (!isNil(targetBytes) && total - bytes <= targetBytes) {
      break
    }

    try {
      await store.delete(object.key)
      count += 1
      bytes += object.size
    } catch {
      // A failed delete leaves the object for the next pass.
    }
  }

  return { count, bytes }
}

/** Every object under refs/, or null when the store cannot list. */
async function listRefs(store: ObjectStore): Promise<ListedObject[] | null> {
  const list = store.list?.bind(store)

  if (isNil(list)) {
    return null
  }

  const objects: ListedObject[] = []

  for await (const object of list('refs/')) {
    objects.push(object)
  }

  return objects
}

function sizeByKey(objects: ListedObject[] | null): Map<string, number> | null {
  if (isNil(objects)) {
    return null
  }

  const sizes = new Map<string, number>()

  for (const object of objects) {
    sizes.set(object.key, object.size)
  }

  return sizes
}

function currentBytes(listing: Map<string, number> | null, uploads: UploadItem[]): number {
  if (isNil(listing)) {
    return trackedRemoteBytes(uploads)
  }

  return sum([...listing.values()])
}

function evictedBytes(listing: Map<string, number> | null, item: RemoteUpload): number {
  const size = listing?.get(item.remote.key)

  return size ?? item.remote.size
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
