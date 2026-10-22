import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/types'

vi.mock('server-only', () => ({}))

const ROOT = path.join(process.cwd(), '.cache', `uploads-update-test-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let updateUpload: (
  id: string,
  patch: (item: UploadItem) => UploadItem,
) => Promise<UploadItem | null>
let saveUploadItem: (item: UploadItem) => Promise<UploadItem>
let removeUpload: (id: string) => Promise<void>

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  ;({ updateUpload, saveUploadItem, removeUpload } = await import('@/server/repos/uploads'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) delete process.env.STORAGE_ROOT
  else process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('updateUpload', () => {
  it('patches the current record', async () => {
    const item = makeItem()

    await saveUploadItem(item)

    const updated = await updateUpload(item.id, (current) => ({
      ...current,
      originalName: 'renamed.png',
    }))

    expect(updated?.originalName).toBe('renamed.png')
  })

  it('returns null after the upload was removed', async () => {
    const item = makeItem()

    await saveUploadItem(item)
    await removeUpload(item.id)

    const updated = await updateUpload(item.id, (current) => current)

    expect(updated).toBeNull()
  })
})

function makeItem(): UploadItem {
  return {
    id: randomUUID(),
    source: 'file',
    kind: 'image',
    mime: 'image/png',
    ext: '.png',
    originalName: 'fixture.png',
    sizeBytes: 4,
    createdAt: new Date().toISOString(),
  }
}
