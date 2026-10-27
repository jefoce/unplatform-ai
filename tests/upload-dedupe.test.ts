import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import type * as UploadRecord from '@/server/repos/upload-record'
import type * as Uploads from '@/server/services/uploads'
import { hashFile } from '@/server/storage/hash'

import { required } from './helpers/required'

interface HashModule {
  hashFile: typeof hashFile
}

vi.mock('server-only', () => {
  return {}
})

vi.mock('@/server/storage/hash', async (importOriginal) => {
  const actual = await importOriginal<HashModule>()

  return { ...actual, hashFile: vi.fn(actual.hashFile) }
})

const ROOT = path.join(process.cwd(), '.cache', `upload-dedupe-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const BYTES = 'identical upload bytes'
const PREVIOUS_ROOT = process.env.STORAGE_ROOT
const hashSpy = vi.mocked(hashFile)

process.env.STORAGE_ROOT = ROOT

let uploads: typeof Uploads
let saveUploadItem: typeof UploadRecord.saveUploadItem
let getUploadRecord: typeof UploadRecord.getUploadRecord

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  uploads = await import('@/server/services/uploads')

  const recordModule = await import('@/server/repos/upload-record')

  saveUploadItem = recordModule.saveUploadItem
  getUploadRecord = recordModule.getUploadRecord
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })

  resetIndexes()
  hashSpy.mockClear()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

/** The size index builds once per root, so each test starts from a cold cache. */
function resetIndexes(): void {
  const host = globalThis as Record<string, unknown>

  delete host[`__upai_uploadSizes:${UPLOADS}`]
  delete host.__upai_uploadIndex
  delete host.__upai_uploadPathHashes
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function makeItem(overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: randomUUID(),
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: Buffer.byteLength(BYTES),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function namesInUploads(): Promise<string[]> {
  return fs.readdir(UPLOADS)
}

describe('upload dedupe', () => {
  it('indexes legacy records by size without hashing', async () => {
    const legacy = Array.from({ length: 50 }, (_, index) => {
      return makeItem({ sizeBytes: 1000 + index })
    })

    await Promise.all(
      legacy.map((item) => {
        return saveUploadItem(item)
      }),
    )

    const bytes = Buffer.from(BYTES)

    const upload = await uploads.createFileUpload({ bytes, originalName: 'new.png' })

    expect(hashSpy).not.toHaveBeenCalled()

    expect(
      legacy.some((item) => {
        return item.id === upload.id
      }),
    ).toBe(false)

    const stored = required(await getUploadRecord(upload.id), 'new upload')

    expect(stored.sha256).toBe(sha256Hex(bytes))
    expect(stored.sizeBytes).toBe(bytes.length)
  })

  it('hashes one same-size candidate before storing different bytes', async () => {
    const candidateBytes = Buffer.from('same size alpha')
    const incomingBytes = Buffer.from('same size bravo')
    const candidate = makeItem({ sizeBytes: candidateBytes.length })

    expect(incomingBytes.length).toBe(candidateBytes.length)

    await fs.writeFile(path.join(UPLOADS, `${candidate.id}${candidate.ext}`), candidateBytes)
    await saveUploadItem(candidate)

    const upload = await uploads.createFileUpload({ bytes: incomingBytes, originalName: 'new.png' })

    expect(upload.id).not.toBe(candidate.id)
    expect(hashSpy).toHaveBeenCalledTimes(1)

    const stored = required(await getUploadRecord(candidate.id), 'candidate')

    expect(stored.sha256).toBe(sha256Hex(candidateBytes))
  })
})

describe('upload dedupe across sources', () => {
  it('returns the file upload for a link of the same bytes', async () => {
    const bytes = Buffer.from('file then link bytes')
    const source = path.join(ROOT, 'file-then-link.png')

    await fs.writeFile(source, bytes)

    const fileUpload = await uploads.createFileUpload({ bytes, originalName: 'a.png' })
    const link = await uploads.createLinkUpload({ absPath: source })

    expect(link.id).toBe(fileUpload.id)
    expect(hashSpy).toHaveBeenCalledTimes(1)

    const names = await namesInUploads()

    expect(
      names.filter((name) => {
        return name.endsWith('.png')
      }),
    ).toHaveLength(1)

    expect(
      names.filter((name) => {
        return name.endsWith('.json')
      }),
    ).toHaveLength(1)
  })

  it('links without hashing when no same-size record exists', async () => {
    const bytes = Buffer.from('lonely link bytes')
    const source = path.join(ROOT, 'lonely-link.png')

    await fs.writeFile(source, bytes)

    const link = await uploads.createLinkUpload({ absPath: source })

    expect(hashSpy).not.toHaveBeenCalled()

    const stored = required(await getUploadRecord(link.id), 'link')

    expect(stored.sha256).toBeUndefined()
  })
})

describe('upload dedupe storage', () => {
  it('stores one file when two identical uploads race', async () => {
    const bytes = Buffer.from('racing identical bytes')

    const [first, second] = await Promise.all([
      uploads.createFileUpload({ bytes, originalName: 'a.png' }),
      uploads.createFileUpload({ bytes, originalName: 'b.png' }),
    ])

    expect(second.id).toBe(first.id)

    const names = await namesInUploads()

    expect(
      names.filter((name) => {
        return name.endsWith('.png')
      }),
    ).toHaveLength(1)
  })

  it('stores a new id after the upload is removed', async () => {
    const bytes = Buffer.from('remove then upload again')
    const first = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    await uploads.removeUpload(first.id)

    const second = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    expect(second.id).not.toBe(first.id)
  })

  it('keeps different bytes apart', async () => {
    const first = await uploads.createFileUpload({
      bytes: Buffer.from('first body'),
      originalName: 'a.png',
    })

    const second = await uploads.createFileUpload({
      bytes: Buffer.from('second body'),
      originalName: 'a.png',
    })

    expect(second.id).not.toBe(first.id)
  })

  it('stores a fresh copy when the media file is gone', async () => {
    const bytes = Buffer.from('vanishing media')
    const first = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    await fs.rm(path.join(UPLOADS, `${first.id}${first.ext}`))

    const second = await uploads.createFileUpload({ bytes, originalName: 'a.png' })

    expect(second.id).not.toBe(first.id)
  })
})
