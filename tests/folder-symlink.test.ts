import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.join(os.tmpdir(), `cf-folder-link-${process.pid}-${Date.now()}`)
const FOLDER = path.join(ROOT, 'folder')
const OUTSIDE = path.join(ROOT, 'outside.mp4')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

type ResolveMediaRef = (segments: string[]) => Promise<{ absolutePath: string }>

type ListFolderFiles = (params: {
  folderId: string
  sub?: string
  kinds?: ('video' | 'image' | 'audio')[]
}) => Promise<{ files: { name: string }[] }>

let resolveMediaRef: ResolveMediaRef
let listFolderFiles: ListFolderFiles
const folderId = randomUUID()

beforeAll(async () => {
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })
  await fs.mkdir(FOLDER, { recursive: true })
  await fs.writeFile(OUTSIDE, 'outside')
  await fs.writeFile(path.join(FOLDER, 'inside.mp4'), 'inside')
  await fs.symlink(OUTSIDE, path.join(FOLDER, 'escape.mp4'))
  await fs.symlink(ROOT, path.join(FOLDER, 'up'))

  await fs.writeFile(
    path.join(ROOT, 'data', 'folders.json'),
    JSON.stringify([
      { id: folderId, name: 'folder', path: FOLDER, addedAt: new Date().toISOString() },
    ]),
  )

  ;({ resolveMediaRef } = await import('@/server/fs/media-ref'))

  ;({ listFolderFiles } = await import('@/server/repos/folders'))
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('folder symlinks', () => {
  it('serves a file that stays inside the folder', async () => {
    const media = await resolveMediaRef(['folders', folderId, 'inside.mp4'])

    expect(media.absolutePath).toBe(await fs.realpath(path.join(FOLDER, 'inside.mp4')))
  })

  it('404s a symlink pointing outside the folder', async () => {
    await expect(resolveMediaRef(['folders', folderId, 'escape.mp4'])).rejects.toMatchObject({
      status: 404,
    })
  })

  it('rejects a sub path that escapes through a symlink', async () => {
    await expect(listFolderFiles({ folderId, sub: 'up' })).rejects.toMatchObject({ status: 400 })
  })

  it('hides an escaping symlink from the folder listing', async () => {
    const listing = await listFolderFiles({ folderId })

    expect(
      listing.files.map((file) => {
        return file.name
      }),
    ).toEqual(['inside.mp4'])
  })
})
