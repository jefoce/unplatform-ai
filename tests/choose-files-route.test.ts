import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'

const chooser = vi.hoisted(() => {
  return { paths: [] as string[] }
})

vi.mock('@/server/system', () => {
  return {
    getSystem: () => {
      return {
        canChooseFiles: async () => {
          return true
        },
        chooseFiles: async () => {
          return chooser.paths
        },
        chooseFolder: async () => {
          return null
        },
        reveal: async () => {},
      }
    },
  }
})

vi.mock('@/server/session', () => {
  return {
    hasSession: () => {
      return true
    },
  }
})

const ROOT = path.join(process.cwd(), '.cache', `choose-files-route-${process.pid}`)
const UPLOADS = path.join(ROOT, 'uploads')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let route: { POST: (request: Request) => Promise<Response> }
let addFolder: (params: { path: string }) => Promise<{ id: string }>
let listUploads: () => Promise<UploadItem[]>

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  route = await import('@/app/api/system/choose-files/route')

  const folders = await import('@/server/repos/folders')

  addFolder = folders.addFolder

  const uploads = await import('@/server/repos/uploads')

  listUploads = uploads.listUploads
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(UPLOADS, { recursive: true })
  resetIndexes()
  chooser.paths = []
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (isNil(PREVIOUS_ROOT)) {
    delete process.env.STORAGE_ROOT
  } else {
    process.env.STORAGE_ROOT = PREVIOUS_ROOT
  }
})

/** The size and path hash caches survive a wiped storage root, so drop them per test. */
function resetIndexes(): void {
  const host = globalThis as Record<string, unknown>

  delete host.__upai_uploadIndex
  delete host.__upai_uploadPathHashes
  delete host[`__upai_uploadSizes:${UPLOADS}`]
}

function chooseRequest(): Request {
  return new Request('http://127.0.0.1:3000/api/system/choose-files', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ kinds: ['image'], multiple: true }),
  })
}

describe('POST /api/system/choose-files', () => {
  it('links a chosen path as its folder item and reuses it', async () => {
    const folderDir = path.join(ROOT, 'folder')
    const file = path.join(folderDir, 'sample.png')

    await fs.mkdir(folderDir, { recursive: true })
    await fs.writeFile(file, Buffer.from('folder link bytes'))
    await addFolder({ path: folderDir })

    chooser.paths = [file]

    const response = await route.POST(chooseRequest())
    const items = (await response.json()) as UploadItem[]
    const [first] = items

    expect(response.status).toBe(201)
    expect(items).toHaveLength(1)
    expect(first?.source).toBe('link')
    expect(first?.originalName).toBe('sample.png')
    expect(first?.target).toBe(await fs.realpath(file))

    const again = await route.POST(chooseRequest())
    const [second] = (await again.json()) as UploadItem[]

    expect(second?.id).toBe(first?.id)
    expect(await listUploads()).toHaveLength(1)
  })

  it('links a path outside every folder by absPath', async () => {
    const file = path.join(ROOT, 'outside.png')

    await fs.writeFile(file, Buffer.from('outside link bytes'))
    chooser.paths = [file]

    const response = await route.POST(chooseRequest())
    const [item] = (await response.json()) as UploadItem[]

    expect(item?.source).toBe('link')
    expect(item?.target).toBe(await fs.realpath(file))
  })
})
