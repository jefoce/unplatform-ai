import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import type {
  forgetUpload as ForgetUpload,
  getUploadRecord as GetUploadRecord,
  listUploadRecords as ListUploadRecords,
  saveUploadItem as SaveUploadItem,
} from '@/server/repos/upload-record'
import type { ensureRemote as EnsureRemote } from '@/server/services/remote-inputs'

import { REMOTE_MAX_GB } from '../src/core/constants'
import { FakeStore, GIB, remoteUpload } from './helpers/remote-fixtures'

const ROOT = path.join(os.tmpdir(), `cf-remote-race-${process.pid}-${Date.now()}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

const CAP_BYTES = REMOTE_MAX_GB * GIB

interface UploadsRepo {
  saveUploadItem: typeof SaveUploadItem
  getUploadRecord: typeof GetUploadRecord
  listUploadRecords: typeof ListUploadRecords
  forgetUpload: typeof ForgetUpload
}

interface PathsModule {
  UPLOADS_DIR: string
  uploadPaths: (id: string, ext: string) => { media: string; json: string }
}

let repo: UploadsRepo
let ensureRemote: typeof EnsureRemote
let paths: PathsModule
let counter = 0

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })

  repo = await import('@/server/repos/upload-record')

  ;({ ensureRemote } = await import('@/server/services/remote-inputs'))
  paths = await import('@/server/paths')
})

beforeEach(async () => {
  for (const item of await repo.listUploadRecords()) {
    await repo.forgetUpload(item.id)
  }

  await fs.rm(paths.UPLOADS_DIR, { recursive: true, force: true })
  await fs.mkdir(paths.UPLOADS_DIR, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

interface UploadFixture {
  item: UploadItem
  media: string
  sha256Base64: string
}

async function fixture(bytes: Buffer): Promise<UploadFixture> {
  counter += 1
  const id = `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
  const media = paths.uploadPaths(id, '.png').media

  const item: UploadItem = {
    ...remoteUpload({
      key: `refs/${id}.png`,
      size: bytes.length,
      lastUsedAt: new Date().toISOString(),
    }),
    id,
    sizeBytes: bytes.length,
    remote: undefined,
  }

  await fs.writeFile(media, bytes)
  await repo.saveUploadItem(item)

  return { item, media, sha256Base64: createHash('sha256').update(bytes).digest('base64') }
}

describe('remote reuse race', () => {
  it('re-reads reuse under the cap lock so an eviction never leaves a dangling key', async () => {
    const uploadA = await fixture(Buffer.from('race-bytes-a'))
    const uploadB = await fixture(Buffer.from('race-bytes-b'))
    const store = new FakeStore()
    const key = `refs/${createHash('sha256').update('race-bytes-a').digest('hex')}.png`

    await store.put({
      key,
      file: uploadA.media,
      sha256: uploadA.sha256Base64,
      contentType: 'image/png',
      onProgress: null,
    })

    const lastModified = Date.now() - 3 * 3_600_000

    store.setLastModified(key, lastModified)
    store.listed.set(key, { key, size: CAP_BYTES, lastModified })

    const entered = Promise.withResolvers<void>()
    const gate = Promise.withResolvers<void>()
    const evicted = Promise.withResolvers<void>()
    const realHead = store.head.bind(store)
    const realDelete = store.delete.bind(store)
    let isFirstHead = true

    store.head = async (headKey) => {
      if (isFirstHead) {
        isFirstHead = false
        entered.resolve()
        await gate.promise
      }

      return realHead(headKey)
    }

    store.delete = async (key) => {
      await realDelete(key)
      evicted.resolve()
    }

    const first = ensureRemote({ upload: uploadA.item, store })

    await entered.promise

    const second = ensureRemote({ upload: uploadB.item, store })

    // While the first reuse is deciding, the second upload must not evict the key.
    await Promise.race([
      evicted.promise,
      new Promise((resolve) => {
        setTimeout(resolve, 300)
      }),
    ])

    expect(store.objects.has(key)).toBe(true)

    gate.resolve()

    const results = await Promise.allSettled([first, second])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(store.objects.has(key)).toBe(true)
    expect(store.deleted).not.toContain(key)
    expect((await repo.getUploadRecord(uploadA.item.id))?.remote?.key).toBe(key)
  })
})
