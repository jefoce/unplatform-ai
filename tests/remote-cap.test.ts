import fs from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { REMOTE_FREE_GB, REMOTE_LINK_TTL_SEC, REMOTE_MAX_GB } from '@/core/constants'
import { friendlyError } from '@/core/provider-errors'
import type { UploadItem } from '@/core/schemas/upload-item'
import { RemoteCapError } from '@/server/errors'
import type { ObjectStore } from '@/server/storage/types'

import {
  daysAgo,
  FakeStore,
  GIB,
  hoursAgo,
  plainUpload,
  type RecordParams,
  remoteUpload,
  uploadWith,
} from './helpers/remote-fixtures'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `remote-cap-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const CAP_BYTES = REMOTE_MAX_GB * GIB

process.env.STORAGE_ROOT = ROOT

interface MakeRoomParams {
  store: ObjectStore
  bytes: number
  keepKey: string
}

interface SweepResult {
  deleted: number
  cleared: number
}

let trackedRemoteBytes: (uploads: UploadItem[]) => number
let makeRoom: (params: MakeRoomParams) => Promise<void>
let sweepRemote: (store?: ObjectStore) => Promise<SweepResult>
let saveUploadItem: (item: UploadItem) => Promise<UploadItem>
let listUploads: () => Promise<UploadItem[]>
let getUpload: (id: string) => Promise<UploadItem | null>
let forgetUpload: (id: string) => Promise<void>

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ trackedRemoteBytes, makeRoom } = await import('@/server/services/remote-cap'))

  ;({ sweepRemote } = await import('@/server/services/remote-inputs'))

  ;({ saveUploadItem, forgetUpload } = await import('@/server/repos/upload-record'))

  ;({ listUploads, getUpload } = await import('@/server/repos/uploads'))
})

beforeEach(async () => {
  const records = await listUploads()

  await Promise.all(
    records.map((item) => {
      return forgetUpload(item.id)
    }),
  )

  await fs.rm(path.join(ROOT, 'uploads'), { recursive: true, force: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

describe('trackedRemoteBytes', () => {
  it('counts each remote key once', () => {
    const uploads = [
      uploadWith('refs/a.png', 10),
      uploadWith('refs/a.png', 10),
      uploadWith('refs/b.png', 5),
      plainUpload(),
    ]

    expect(trackedRemoteBytes(uploads)).toBe(15)
  })
})

describe('makeRoom', () => {
  it('deletes the oldest expired key first', async () => {
    const store = new FakeStore()

    const old = await makeRecord({
      key: 'refs/old.png',
      size: 2 * GIB,
      lastUsedAt: daysAgo(10),
    })

    const oldTwin = await makeRecord({
      key: 'refs/old.png',
      size: 2 * GIB,
      lastUsedAt: daysAgo(9),
    })

    const mid = await makeRecord({
      key: 'refs/mid.png',
      size: 2 * GIB,
      lastUsedAt: daysAgo(5),
    })

    const newer = await makeRecord({
      key: 'refs/newer.png',
      size: 2 * GIB,
      lastUsedAt: daysAgo(1),
    })

    const tracked = trackedRemoteBytes(await listUploads())

    await makeRoom({ store, bytes: CAP_BYTES - tracked + 1, keepKey: 'refs/incoming.png' })

    expect(store.deleted).toEqual(['refs/old.png'])
    expect((await getUpload(old.id))?.remote).toBeUndefined()
    expect((await getUpload(oldTwin.id))?.remote).toBeUndefined()
    expect((await getUpload(mid.id))?.remote?.key).toBe('refs/mid.png')
    expect((await getUpload(newer.id))?.remote?.key).toBe('refs/newer.png')
  })

  it('never evicts a key used inside the link TTL', async () => {
    const store = new FakeStore()

    const recent = await makeRecord({
      key: 'refs/recent.png',
      size: 2 * GIB,
      lastUsedAt: hoursAgo(1),
    })

    await expect(
      makeRoom({ store, bytes: CAP_BYTES + 1, keepKey: 'refs/incoming.png' }),
    ).rejects.toBeInstanceOf(RemoteCapError)

    expect(store.deleted).toEqual([])
    expect((await getUpload(recent.id))?.remote?.key).toBe('refs/recent.png')
  })

  it('throws the cap error when nothing evictable makes room', async () => {
    const store = new FakeStore()

    await makeRecord({ key: 'refs/old.png', size: GIB, lastUsedAt: daysAgo(40) })

    const error: unknown = await makeRoom({
      store,
      bytes: CAP_BYTES + 1,
      keepKey: 'refs/incoming.png',
    }).catch((caught: unknown) => {
      return caught
    })

    expect(error).toBeInstanceOf(RemoteCapError)

    const expected = `R2 is at the app's ${REMOTE_MAX_GB} GB limit, which keeps it inside the free ${REMOTE_FREE_GB} GB. References used in the last ${REMOTE_LINK_TTL_SEC / 3600} hours cannot be removed yet. Try again later, or use shorter clips.`

    expect((error as Error).message).toBe(expected)

    const friendly = friendlyError({ raw: expected, family: null, httpRules: null })

    expect(friendly.title).toBe('Cloud storage is full.')
    expect(friendly.hint).toContain('Try again later, or use shorter clips.')
  })
})

describe('sweepRemote', () => {
  it('keeps the retention window and clears shared keys once', async () => {
    const store = new FakeStore()

    const oldA = await makeRecord({
      key: 'refs/shared.png',
      size: 10,
      lastUsedAt: daysAgo(40),
    })

    const oldB = await makeRecord({
      key: 'refs/shared.png',
      size: 10,
      lastUsedAt: daysAgo(31),
    })

    const oldSingle = await makeRecord({
      key: 'refs/single.png',
      size: 10,
      lastUsedAt: daysAgo(45),
    })

    const kept = await makeRecord({
      key: 'refs/kept.png',
      size: 10,
      lastUsedAt: daysAgo(1),
    })

    const result = await sweepRemote(store)

    expect(result).toEqual({ deleted: 2, cleared: 3 })
    expect(store.deleted.sort()).toEqual(['refs/shared.png', 'refs/single.png'])
    expect((await getUpload(oldA.id))?.remote).toBeUndefined()
    expect((await getUpload(oldB.id))?.remote).toBeUndefined()
    expect((await getUpload(oldSingle.id))?.remote).toBeUndefined()
    expect((await getUpload(kept.id))?.remote?.key).toBe('refs/kept.png')
  })
})

function makeRecord(params: RecordParams): Promise<UploadItem> {
  return saveUploadItem(remoteUpload(params))
}
