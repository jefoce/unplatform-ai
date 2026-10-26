import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { readJson } from '@/server/fs/json-file'

const ItemSchema = z.object({ id: z.string() })

let dir = ''
let file = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-json-file-'))
  file = path.join(dir, 'bad.json')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

describe('readJson warnings', () => {
  it('warns once for the same broken file and mtime', async () => {
    await fs.writeFile(file, JSON.stringify({ id: 1 }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await readJson(file, ItemSchema)).toBeNull()
    expect(await readJson(file, ItemSchema)).toBeNull()

    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('warns again after the file mtime changes', async () => {
    await fs.writeFile(file, JSON.stringify({ id: 1 }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await readJson(file, ItemSchema)
    await fs.utimes(file, new Date(), new Date(Date.now() + 5000))
    await readJson(file, ItemSchema)

    expect(warn).toHaveBeenCalledTimes(2)
  })
})
