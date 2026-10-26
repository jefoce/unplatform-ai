import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { jsonDirStore } from '@/server/repos/json-dir-store'

const ItemSchema = z.object({ id: z.string() })

let dir = ''

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-json-dir-store-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

function openStore() {
  return jsonDirStore({
    key: `jsonDirStoreTest:${dir}`,
    dir,
    fileOf: (id) => {
      return path.join(dir, `${id}.json`)
    },
    schema: ItemSchema,
  })
}

function writeJson(name: string, data: unknown): Promise<void> {
  return fs.writeFile(path.join(dir, name), JSON.stringify(data))
}

describe('jsonDirStore load', () => {
  it('indexes uuid records and warns only for a broken record', async () => {
    const id = randomUUID()
    const brokenId = randomUUID()

    await writeJson(`${id}.json`, { id })
    await writeJson(`${brokenId}.json`, { id: 42 })
    await writeJson(`${id}.encoded-1.json`, {})
    await writeJson(`${id}.opaque.json`, true)
    await writeJson('not-a-uuid.json', { id: 42 })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const records = await openStore().list()

    expect(records).toEqual([{ id }])
    expect(warn).toHaveBeenCalledTimes(1)

    const warnings = warn.mock.calls.map((call) => {
      return String(call[0])
    })

    expect(warnings[0]).toContain(`${brokenId}.json`)
    expect(warnings.join('\n')).not.toContain(`${id}.encoded-1.json`)
    expect(warnings.join('\n')).not.toContain(`${id}.opaque.json`)
  })

  it('reads a record written after load and skips non-uuid names silently', async () => {
    const store = openStore()

    await writeJson('not-a-uuid.json', { id: 42 })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await store.list()).toEqual([])

    const id = randomUUID()

    await writeJson(`${id}.json`, { id })

    expect(await store.get(id)).toEqual({ id })
    expect(warn).not.toHaveBeenCalled()
  })
})
