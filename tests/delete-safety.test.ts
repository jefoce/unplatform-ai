import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { removeOwnedFile as RemoveOwnedFile } from '@/server/fs/json-file'
import type * as Folders from '@/server/repos/folders'
import type * as Generations from '@/server/repos/generations'
import type * as Images from '@/server/repos/images'
import type * as Uploads from '@/server/services/uploads'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'

vi.mock('server-only', () => {
  return {}
})

const ROOT = path.join(process.cwd(), '.cache', `delete-safety-test-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const OUTSIDE = path.join(process.cwd(), '.cache', `delete-safety-outside-${process.pid}`)
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let removeOwnedFile: typeof RemoveOwnedFile
let folders: typeof Folders
let generations: typeof Generations
let images: typeof Images
let uploads: typeof Uploads

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.rm(OUTSIDE, { recursive: true, force: true })

  await fs.mkdir(OUTSIDE, { recursive: true })

  ;({ removeOwnedFile } = await import('@/server/fs/json-file'))
  folders = await import('@/server/repos/folders')
  generations = await import('@/server/repos/generations')
  images = await import('@/server/repos/images')
  uploads = await import('@/server/services/uploads')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.rm(OUTSIDE, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => {
      return true
    },
    () => {
      return false
    },
  )
}

function makeActiveRecord(uploadId: string): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: '',
      audio: false,
      duration: 4,
      aspectRatio: 'auto',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [uploadId],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}

describe('removeOwnedFile', () => {
  it('deletes a uuid basename inside the storage root', async () => {
    const file = path.join(ROOT, `${randomUUID()}.png`)

    await fs.writeFile(file, 'x')
    await removeOwnedFile(file)

    expect(await exists(file)).toBe(false)
  })

  it('deletes a hash basename inside the storage root', async () => {
    const file = path.join(ROOT, `${'a'.repeat(40)}.webp`)

    await fs.writeFile(file, 'x')
    await removeOwnedFile(file)

    expect(await exists(file)).toBe(false)
  })

  it('refuses a path outside the storage root', async () => {
    const file = path.join(OUTSIDE, `${randomUUID()}.png`)

    await fs.writeFile(file, 'x')

    await expect(removeOwnedFile(file)).rejects.toThrow('Refusing to delete outside storage')
    expect(await exists(file)).toBe(true)
  })

  it('refuses a basename the app does not own', async () => {
    const file = path.join(ROOT, 'notes.txt')

    await fs.writeFile(file, 'x')

    await expect(removeOwnedFile(file)).rejects.toThrow(
      'Refusing to delete a file the app does not own',
    )

    expect(await exists(file)).toBe(true)
  })

  it('treats a missing owned file as success', async () => {
    await expect(removeOwnedFile(path.join(ROOT, `${randomUUID()}.png`))).resolves.toBeUndefined()
  })
})

describe('upload delete safety', () => {
  it('leaves a link target outside the storage root untouched', async () => {
    const target = path.join(OUTSIDE, 'source.png')

    await fs.writeFile(target, 'not really a png')

    const item = await uploads.createLinkUpload({ absPath: target })

    await uploads.removeUpload(item.id)

    expect(await exists(target)).toBe(true)
  })

  it('refuses to delete an upload used by a running generation', async () => {
    const target = path.join(OUTSIDE, 'busy.png')

    await fs.writeFile(target, 'not really a png')

    const item = await uploads.createLinkUpload({ absPath: target })

    await generations.saveGeneration(makeActiveRecord(item.id))

    await expect(uploads.removeUpload(item.id)).rejects.toThrow('Used by a running generation')

    expect(await exists(path.join(UPLOADS, `${item.id}${item.ext}`))).toBe(true)
    expect(await exists(path.join(UPLOADS, `${item.id}.json`))).toBe(true)
  })
})

function makeActiveImage(uploadId: string): ImageRecord {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'saving',
    provider: 'openrouter',
    preset: { id: 'gemini-3.1-flash-image', title: 'Nano Banana 2', slug: 'gemini' },
    input: {
      presetId: 'gemini-3.1-flash-image',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [uploadId],
      seed: null,
    },
    outputs: [],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

describe('image upload delete safety', () => {
  it('refuses to delete an upload used by a running image job', async () => {
    const target = path.join(OUTSIDE, 'image-busy.png')

    await fs.writeFile(target, 'not really a png')

    const item = await uploads.createLinkUpload({ absPath: target })

    await images.saveImage(makeActiveImage(item.id))

    await expect(uploads.removeUpload(item.id)).rejects.toThrow('Used by a running generation')

    expect(await exists(path.join(UPLOADS, `${item.id}${item.ext}`))).toBe(true)
    expect(await exists(path.join(UPLOADS, `${item.id}.json`))).toBe(true)
  })
})

describe('folder disconnect safety', () => {
  it('leaves every file in the folder untouched', async () => {
    const folderDir = path.join(OUTSIDE, 'folder')

    await fs.mkdir(folderDir, { recursive: true })
    await fs.writeFile(path.join(folderDir, 'a.png'), 'a')
    await fs.writeFile(path.join(folderDir, 'b.png'), 'b')

    const folder = await folders.addFolder({ path: folderDir })

    await folders.removeFolder(folder.id)

    expect((await fs.readdir(folderDir)).sort()).toEqual(['a.png', 'b.png'])
  })
})
