import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

import type { HasId } from '@/core/utility-types'

import { listJsonFileNames, readJson } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { globalState } from '../global-state'

export const JSON_DIR_CHANGES = ['remember', 'forget'] as const

export type JsonDirChangeKind = (typeof JSON_DIR_CHANGES)[number]

export interface JsonDirChange {
  id: string
  kind: JsonDirChangeKind
}

interface IndexState<T> {
  map: Map<string, T>
  dirMtimeMs: number
  loaded: boolean
  writeSeq: number
  idSeq: Map<string, number>
  loading: Promise<Map<string, T>> | null
  listeners: Set<(change: JsonDirChange) => void>
}

export interface JsonDirStore<T extends HasId> {
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  read(id: string): Promise<T | null>
  remember(item: T): Promise<void>
  forget(id: string): Promise<void>
  onChange(listener: (change: JsonDirChange) => void): () => void
}

interface JsonDirStoreParams<T> {
  key: string
  dir: string
  fileOf: (id: string) => string
  schema: ZodType<T>
}

interface JsonDirLoadParams<T> {
  state: IndexState<T>
  dir: string
  schema: ZodType<T>
}

interface JsonDirReloadParams<T> extends JsonDirLoadParams<T> {
  mtimeMs: number
}

function directoryMtime(dir: string): Promise<number> {
  return fs.stat(dir).then(
    (stats) => {
      return stats.mtimeMs
    },
    () => {
      return 0
    },
  )
}

function notifyAll(listeners: Set<(change: JsonDirChange) => void>, change: JsonDirChange): void {
  for (const listener of listeners) {
    listener(change)
  }
}

async function load<T extends HasId>(params: JsonDirLoadParams<T>): Promise<Map<string, T>> {
  const { state, dir } = params
  const mtimeMs = await directoryMtime(dir)

  if (state.loaded && state.dirMtimeMs === mtimeMs) {
    return state.map
  }

  if (state.loading) {
    return state.loading
  }

  const pending = reload({ ...params, mtimeMs }).finally(() => {
    state.loading = null
  })

  state.loading = pending

  return pending
}

/**
 * Merges the directory into the index.
 * Writes that landed after the first read win over the older copy on disk.
 */
async function reload<T extends HasId>(params: JsonDirReloadParams<T>): Promise<Map<string, T>> {
  const { state, dir, schema, mtimeMs } = params
  const seqAtStart = state.writeSeq

  const names = (await listJsonFileNames(dir)).filter((name) => {
    return isUuid(path.basename(name, '.json'))
  })

  const records: (T | null)[] = await Promise.all(
    names.map((name) => {
      return readJson(path.join(dir, name), schema)
    }),
  )

  const byId = new Map<string, T>()

  for (const record of records) {
    if (!isNil(record)) {
      byId.set(record.id, record)
    }
  }

  for (const [id, seq] of state.idSeq) {
    if (seq <= seqAtStart) {
      continue
    }

    const current = state.map.get(id)

    if (current) {
      byId.set(id, current)
    } else {
      byId.delete(id)
    }
  }

  state.map = byId
  state.loaded = true

  if (state.writeSeq === seqAtStart) {
    state.dirMtimeMs = mtimeMs
  } else {
    state.dirMtimeMs = await directoryMtime(dir)
  }

  return state.map
}

/**
 * Indexes `<id>.json` files in one directory, reloading when its mtime changes.
 */
export function jsonDirStore<T extends HasId>(params: JsonDirStoreParams<T>): JsonDirStore<T> {
  const { key, dir, fileOf, schema } = params

  const state = globalState<IndexState<T>>(key, () => {
    return {
      map: new Map(),
      dirMtimeMs: -1,
      loaded: false,
      writeSeq: 0,
      idSeq: new Map(),
      loading: null,
      listeners: new Set(),
    }
  })

  function markWrite(id: string): void {
    state.writeSeq += 1
    state.idSeq.set(id, state.writeSeq)
  }

  function read(id: string): Promise<T | null> {
    return readJson(fileOf(id), schema)
  }

  async function refreshMtime(): Promise<void> {
    if (!state.loaded) {
      return
    }

    state.dirMtimeMs = await directoryMtime(dir)
  }

  return {
    async list() {
      return Array.from((await load({ state, dir, schema })).values())
    },
    async get(id) {
      const map = state.loaded ? state.map : null
      const cached = map?.get(id)

      if (cached) {
        return cached
      }

      const record = await read(id)

      if (record) {
        state.map.set(id, record)
      }

      return record
    },
    read,
    async remember(item) {
      markWrite(item.id)
      state.map.set(item.id, item)
      await refreshMtime()
      notifyAll(state.listeners, { id: item.id, kind: 'remember' })
    },
    async forget(id) {
      markWrite(id)
      state.map.delete(id)
      await refreshMtime()
      notifyAll(state.listeners, { id, kind: 'forget' })
    },
    onChange(listener) {
      state.listeners.add(listener)

      return () => {
        state.listeners.delete(listener)
      }
    },
  }
}
