import 'server-only'

import { isNil } from 'lodash-es'

import type { ListedObject, ObjectStore } from '../storage/types'

interface ListingEntry {
  value: ListedObject[] | null
  expiresAt: number
}

const LISTING_TTL_MS = 10_000
const FAIL_TTL_MS = 1_000
const listings = new WeakMap<ObjectStore, ListingEntry>()

/** One refs/ listing per store for a short window, or null when listing fails. */
export async function listRemoteObjects(store: ObjectStore): Promise<ListedObject[] | null> {
  const cached = listings.get(store)

  if (!isNil(cached) && Date.now() < cached.expiresAt) {
    return cached.value
  }

  const value = await listRefs(store)
  const isFailed = isNil(value)
  const ttlMs = isFailed ? FAIL_TTL_MS : LISTING_TTL_MS

  listings.set(store, { value, expiresAt: Date.now() + ttlMs })

  return value
}

/** Drops a cached listing after a put or delete. */
export function forgetRemoteListing(store: ObjectStore): void {
  listings.delete(store)
}

async function listRefs(store: ObjectStore): Promise<ListedObject[] | null> {
  const list = store.list?.bind(store)

  if (isNil(list)) {
    return null
  }

  const objects: ListedObject[] = []

  try {
    for await (const object of list('refs/')) {
      objects.push(object)
    }
  } catch {
    return null
  }

  return objects
}
