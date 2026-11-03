import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type * as FoldersModule from '@/server/repos/folders'

const ROOT = path.join(os.tmpdir(), `cf-folders-corrupt-${process.pid}-${Date.now()}`)
const DATA = path.join(ROOT, 'data')
const FOLDERS = path.join(DATA, 'folders.json')
const FOLDER = path.join(ROOT, 'folder')
const PREVIOUS_ROOT = process.env.STORAGE_ROOT

process.env.STORAGE_ROOT = ROOT

let folders: typeof FoldersModule

beforeAll(async () => {
  folders = await import('@/server/repos/folders')
})

beforeEach(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })
  await fs.mkdir(FOLDER, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true })

  if (PREVIOUS_ROOT === undefined) {
    delete process.env.STORAGE_ROOT

    return
  }

  process.env.STORAGE_ROOT = PREVIOUS_ROOT
})

describe('folders file read', () => {
  it('adds the first folder when the file is missing', async () => {
    const item = await folders.addFolder({ path: FOLDER })
    const saved = JSON.parse(await fs.readFile(FOLDERS, 'utf8')) as unknown

    expect(saved).toEqual([item])
    expect(await folders.listFolders()).toEqual([item])
  })

  it('refuses to overwrite an invalid folders file', async () => {
    await fs.mkdir(DATA, { recursive: true })

    const corrupted = '[{"id": 42}]'

    await fs.writeFile(FOLDERS, corrupted)

    await expect(folders.addFolder({ path: FOLDER })).rejects.toMatchObject({ status: 500 })

    expect(await fs.readFile(FOLDERS, 'utf8')).toBe(corrupted)
  })

  it('refuses to overwrite a folders file it cannot read', async () => {
    await fs.mkdir(DATA, { recursive: true })
    await fs.mkdir(FOLDERS)

    await expect(folders.addFolder({ path: FOLDER })).rejects.toMatchObject({ status: 500 })

    expect((await fs.stat(FOLDERS)).isDirectory()).toBe(true)
  })
})
