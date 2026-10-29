import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import type { FileHash } from '@/server/storage/hash'
import type { ObjectInfo, ObjectStore, PutObjectParams } from '@/server/storage/types'

import { daysAgo, FakeStore } from './helpers/remote-fixtures'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `remote-inputs-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

interface EnsureRemoteParams {
  upload: UploadItem
  onProgress?: (sent: number, total: number) => void
  store?: ObjectStore
}

type EnsureRemote = (params: EnsureRemoteParams) => Promise<UploadItem>

let ensureRemote: EnsureRemote
let saveUploadItem: (item: UploadItem) => Promise<UploadItem>
let removeUpload: (id: string) => Promise<void>
let hashFile: (file: string) => Promise<FileHash>

interface PutOnceParams {
  store: ObjectStore
  key: string
  file: string
  opts: { contentType: string; sha256: string }
}

let putOnce: (params: PutOnceParams) => Promise<ObjectInfo>

class GatedStore extends FakeStore {
  private startPut!: () => void
  private finishPut!: () => void
  readonly started = new Promise<void>((resolve) => {
    this.startPut = resolve
  })

  private readonly gate = new Promise<void>((resolve) => {
    this.finishPut = resolve
  })

  override async put(params: PutObjectParams): Promise<ObjectInfo> {
    const { key } = params

    this.startPut()
    await this.gate
    const info = { key, size: 1, serverSha256: null, lastModified: Date.now() }

    this.objects.set(key, info)

    return info
  }

  release(): void {
    this.finishPut()
  }
}

function remoteOf(upload: UploadItem): NonNullable<UploadItem['remote']> {
  if (isNil(upload.remote)) {
    throw new Error(`Missing remote for ${upload.id}`)
  }

  return upload.remote
}

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  ;({ ensureRemote, putOnce } = await import('@/server/services/remote-inputs'))

  ;({ saveUploadItem } = await import('@/server/repos/upload-record'))

  ;({ removeUpload } = await import('@/server/services/uploads'))

  ;({ hashFile } = await import('@/server/storage/hash'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

describe('ensureRemote', () => {
  it('reuses a remote by size and mtime and refreshes lastUsedAt', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('alpha')
    const first = await ensureRemote({ upload, onProgress: undefined, store })

    expect(store.puts).toHaveLength(1)

    const old: UploadItem = {
      ...first,
      remote: { ...remoteOf(first), lastUsedAt: '2000-01-01T00:00:00.000Z' },
    }

    await saveUploadItem(old)
    const second = await ensureRemote({ upload: old, onProgress: undefined, store })

    expect(store.puts).toHaveLength(1)
    expect(second.remote?.uploadedAt).toBe(first.remote?.uploadedAt)
    expect(second.remote?.lastUsedAt).not.toBe(old.remote?.lastUsedAt)
  })

  it('reuses an object found by head without a local remote record', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('beta')
    const digest = await hashFile(mediaPath(upload.id))
    const key = `refs/${digest.sha256Hex}.png`

    store.objects.set(key, {
      key,
      size: digest.size,
      serverSha256: digest.sha256Base64,
      lastModified: Date.now(),
    })

    const result = await ensureRemote({ upload, onProgress: undefined, store })

    expect(store.puts).toHaveLength(0)
    expect(result.remote?.key).toBe(key)
    expect(result.remote?.sha256).toBe(digest.sha256Hex)
  })

  it('re-uploads when the object is missing', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('gamma')
    const first = await ensureRemote({ upload, onProgress: undefined, store })

    store.objects.delete(remoteOf(first).key)

    const second = await ensureRemote({ upload: first, onProgress: undefined, store })

    expect(store.puts).toHaveLength(2)
    expect(second.remote?.key).toBe(first.remote?.key)
  })

  it('does not resurrect an upload removed during the remote put', async () => {
    const store = new GatedStore()
    const upload = await makeUpload('removed')
    const pending = ensureRemote({ upload, onProgress: undefined, store })

    await store.started
    await removeUpload(upload.id)
    store.release()

    await expect(pending).rejects.toThrow('Input file was removed during upload')
  })

  it('re-uploads when the server checksum differs', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('delta')
    const first = await ensureRemote({ upload, onProgress: undefined, store })

    const remote = remoteOf(first)

    store.objects.set(remote.key, {
      key: remote.key,
      size: remote.size,
      serverSha256: 'wrong-checksum',
      lastModified: Date.now(),
    })

    const second = await ensureRemote({ upload: first, onProgress: undefined, store })

    expect(store.puts).toHaveLength(2)
    expect(second.remote?.serverSha256).toBe(first.remote?.serverSha256)
  })
})

describe('ensureRemote refresh', () => {
  it('re-uploads a remote older than the refresh window and resets its dates', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('old-head')
    const first = await ensureRemote({ upload, onProgress: undefined, store })
    const remote = remoteOf(first)

    const old: UploadItem = {
      ...first,
      remote: { ...remote, uploadedAt: daysAgo(40), lastUsedAt: daysAgo(40) },
    }

    await saveUploadItem(old)
    store.setLastModified(remote.key, Date.now() - 26 * 86_400_000)
    store.headCalls = 0

    const second = await ensureRemote({ upload: old, onProgress: undefined, store })

    expect(store.headCalls).toBe(1)
    expect(store.puts).toHaveLength(2)
    expect(second.remote?.uploadedAt).not.toBe(old.remote?.uploadedAt)
    expect(second.remote?.lastUsedAt).not.toBe(old.remote?.lastUsedAt)
    expect(Date.parse(second.remote?.uploadedAt ?? '')).toBeGreaterThan(Date.now() - 60_000)
    expect(Date.parse(second.remote?.lastUsedAt ?? '')).toBeGreaterThan(Date.now() - 60_000)
  })

  it('reuses a remote younger than the refresh window', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('young-head')
    const first = await ensureRemote({ upload, onProgress: undefined, store })
    const remote = remoteOf(first)

    const old: UploadItem = {
      ...first,
      remote: { ...remote, lastUsedAt: daysAgo(40) },
    }

    await saveUploadItem(old)
    store.setLastModified(remote.key, Date.now() - 10 * 86_400_000)
    store.headCalls = 0

    const second = await ensureRemote({ upload: old, onProgress: undefined, store })

    expect(store.headCalls).toBe(1)
    expect(store.puts).toHaveLength(1)
    expect(second.remote?.uploadedAt).toBe(old.remote?.uploadedAt)
    expect(second.remote?.lastUsedAt).not.toBe(old.remote?.lastUsedAt)
  })

  it('heads once when the object is deleted and the file is unchanged', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('deleted-head')
    const first = await ensureRemote({ upload, onProgress: undefined, store })
    const remote = remoteOf(first)

    store.markDeleted(remote.key)
    store.headCalls = 0

    const second = await ensureRemote({ upload: first, onProgress: undefined, store })

    expect(store.headCalls).toBe(1)
    expect(store.puts).toHaveLength(2)
    expect(second.remote?.key).toBe(remote.key)
  })
})

describe('putOnce', () => {
  it('runs one put for parallel calls with the same key', async () => {
    const store = new FakeStore()
    const upload = await makeUpload('epsilon')
    const key = `refs/${upload.id}.png`
    const opts = { contentType: 'image/png', sha256: upload.id }

    await Promise.all([
      putOnce({ store, key, file: mediaPath(upload.id), opts }),
      putOnce({ store, key, file: mediaPath(upload.id), opts }),
    ])

    expect(store.puts).toEqual([key])
  })
})

function mediaPath(id: string): string {
  return path.join(ROOT, 'uploads', `${id}.png`)
}

async function makeUpload(text: string): Promise<UploadItem> {
  const id = randomUUID()

  await fs.mkdir(path.join(ROOT, 'uploads'), { recursive: true })
  await fs.writeFile(mediaPath(id), text)

  const item: UploadItem = {
    id,
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: Buffer.byteLength(text),
    createdAt: new Date().toISOString(),
  }

  return saveUploadItem(item)
}
