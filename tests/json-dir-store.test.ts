import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type * as JsonFile from '@/server/fs/json-file'
import {
  JSON_DIR_CHANGES,
  type JsonDirChangeKind,
  jsonDirStore,
} from '@/server/repos/json-dir-store'

const ItemSchema = z.object({ id: z.string(), version: z.number().optional() })

const readControl = vi.hoisted(() => {
  return {
    count: 0,
    wait: null as null | (() => Promise<void>),
  }
})

vi.mock('@/server/fs/json-file', async (importOriginal) => {
  const actual = await importOriginal<typeof JsonFile>()

  return {
    ...actual,
    readJson: async <T>(file: string, schema: z.ZodType<T>): Promise<T | null> => {
      readControl.count += 1

      const wait = readControl.wait

      if (wait) {
        readControl.wait = null
        await wait()
      }

      return actual.readJson(file, schema)
    },
  }
})

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolve!: () => void

  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

function holdNextRead(started: Deferred, release: Deferred): void {
  readControl.wait = async () => {
    started.resolve()
    await release.promise
  }
}

let dir = ''

beforeEach(async () => {
  readControl.count = 0
  readControl.wait = null
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-json-dir-store-'))
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

describe('jsonDirStore load races', () => {
  it('keeps a remember that lands while a list load is pending', async () => {
    const id = randomUUID()
    const store = openStore()

    await writeJson(`${id}.json`, { id, version: 1 })

    const started = createDeferred()
    const release = createDeferred()

    holdNextRead(started, release)

    const pending = store.list()

    await started.promise

    const newer = { id, version: 2 }

    await store.remember(newer)
    release.resolve()
    await pending

    expect(await store.list()).toEqual([newer])
    expect(await store.get(id)).toEqual(newer)
  })

  it('keeps a forget that lands while a list load is pending', async () => {
    const id = randomUUID()
    const store = openStore()

    await writeJson(`${id}.json`, { id, version: 1 })

    const started = createDeferred()
    const release = createDeferred()

    holdNextRead(started, release)

    const pending = store.list()

    await started.promise
    await store.forget(id)
    release.resolve()
    await pending

    expect(await store.list()).toEqual([])
  })

  it('shares one load between concurrent list callers', async () => {
    const id = randomUUID()
    const store = openStore()

    await writeJson(`${id}.json`, { id, version: 1 })

    const started = createDeferred()
    const release = createDeferred()

    holdNextRead(started, release)

    const first = store.list()
    const second = store.list()

    await started.promise
    release.resolve()

    expect(await Promise.all([first, second])).toEqual([[{ id, version: 1 }], [{ id, version: 1 }]])
    expect(readControl.count).toBe(1)
  })
})

describe('jsonDirStore onChange', () => {
  it('notifies the changed id and kind, then stops after unsubscribe', async () => {
    const store = openStore()
    const listener = vi.fn()
    const id = randomUUID()

    expect(JSON_DIR_CHANGES).toEqual(['remember', 'forget'] satisfies JsonDirChangeKind[])

    const unsubscribe = store.onChange(listener)

    await store.remember({ id })

    expect(listener).toHaveBeenLastCalledWith({ id, kind: 'remember' })

    await store.forget(id)

    expect(listener).toHaveBeenLastCalledWith({ id, kind: 'forget' })

    unsubscribe()
    await store.remember({ id })

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
