import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as AtomicFile from '@/server/fs/atomic-file'
import type * as JsonFile from '@/server/fs/json-file'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-upload-order-'))

process.env.STORAGE_ROOT = root

const calls = vi.hoisted(() => {
  return [] as string[]
})

vi.mock('@/server/fs/atomic-file', async (importOriginal) => {
  const actual = await importOriginal<typeof AtomicFile>()

  return {
    ...actual,
    commitFile: async (params: Parameters<typeof actual.commitFile>[0]) => {
      calls.push(`commit:${params.target}`)

      return actual.commitFile(params)
    },
  }
})

vi.mock('@/server/fs/json-file', async (importOriginal) => {
  const actual = await importOriginal<typeof JsonFile>()

  return {
    ...actual,
    writeJsonAtomic: async (params: Parameters<typeof actual.writeJsonAtomic>[0]) => {
      calls.push(`json:${params.file}`)

      return actual.writeJsonAtomic(params)
    },
  }
})

const uploads = await import('@/server/repos/uploads')
const { UPLOADS_DIR } = await import('@/server/paths')

beforeAll(async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
})

beforeEach(() => {
  calls.length = 0
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('upload media commit order', () => {
  it('commits the media file before the record for a byte upload', async () => {
    const bytes = Buffer.from('image-bytes')

    const item = await uploads.saveFileUpload({
      bytes,
      originalName: 'photo.png',
      sha256: 'a'.repeat(64),
    })

    const media = path.join(UPLOADS_DIR, `${item.id}.png`)

    expect(calls[0]).toBe(`commit:${media}`)
    expect(calls[1]).toBe(`json:${path.join(UPLOADS_DIR, `${item.id}.json`)}`)
    expect(await fs.readFile(media)).toEqual(bytes)
  })

  it('commits the staged media file before the record', async () => {
    const temp = path.join(root, `staged-${randomUUID()}.tmp-`)
    const bytes = Buffer.from('staged-image-bytes')

    await fs.writeFile(temp, bytes)

    const item = await uploads.saveStagedUpload({
      temp,
      originalName: 'staged.png',
      sha256: 'b'.repeat(64),
      sizeBytes: bytes.length,
    })

    const media = path.join(UPLOADS_DIR, `${item.id}.png`)

    expect(calls[0]).toBe(`commit:${media}`)
    expect(calls[1]).toBe(`json:${path.join(UPLOADS_DIR, `${item.id}.json`)}`)
    expect(await fs.readFile(media)).toEqual(bytes)
  })
})
