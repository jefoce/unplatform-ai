import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ObjectStore } from '@/server/storage/types'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `storage-put-time-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

/** A source file older than the lifecycle window still uploads now. */
const OLD_MS = 60 * 24 * 60 * 60 * 1000

let store: ObjectStore

beforeAll(async () => {
  await fs.mkdir(ROOT, { recursive: true })

  const { createMockStore } = await import('@/server/storage/mock-store')

  store = createMockStore()
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

describe('mock store put', () => {
  it('stamps a fresh lastModified even when the source file is old', async () => {
    const source = path.join(ROOT, 'old-reference.bin')
    const old = new Date(Date.now() - OLD_MS)

    await fs.writeFile(source, 'reference-bytes')
    await fs.utimes(source, old, old)

    const result = await store.put({
      key: `refs/${randomUUID()}.bin`,
      file: source,
      contentType: 'application/octet-stream',
      sha256: 'test-sha256',
      onProgress: null,
    })

    expect(Date.now() - result.lastModified).toBeLessThan(60_000)
  })
})
