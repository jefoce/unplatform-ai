import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'

import { listJsonFileNames, readJson } from '../fs/json-file'
import { globalState } from '../global-state'

interface IndexState<T> {
  map: Map<string, T>
  dirMtimeMs: number
  loaded: boolean
}

export interface JsonDirStore<T extends { id: string }> {
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  remember(item: T): Promise<void>
  forget(id: string): Promise<void>
}

interface JsonDirStoreParams {
  key: string
  dir: string
  fileOf: (id: string) => string
}

/** Indexes `<id>.json` files in one directory, reloading when its mtime changes. */
export function jsonDirStore<T extends { id: string }>(
  params: JsonDirStoreParams,
): JsonDirStore<T> {
  const { key, dir, fileOf } = params
  const state = globalState<IndexState<T>>(key, () => ({
    map: new Map(),
    dirMtimeMs: -1,
    loaded: false,
  }))

  const dirMtime = (): Promise<number> =>
    fs.stat(dir).then(
      (stats) => stats.mtimeMs,
      () => 0,
    )

  async function load(): Promise<Map<string, T>> {
    const mtimeMs = await dirMtime()

    if (state.loaded && state.dirMtimeMs === mtimeMs) return state.map

    const names = await listJsonFileNames(dir)
    const records: (T | null)[] = await Promise.all(
      names.map((name) => readJson<T>(path.join(dir, name))),
    )

    state.map = new Map(
      records.filter((record): record is T => !isNil(record)).map((record) => [record.id, record]),
    )
    state.dirMtimeMs = mtimeMs
    state.loaded = true

    return state.map
  }

  async function refreshMtime(): Promise<void> {
    if (!state.loaded) return

    state.dirMtimeMs = await dirMtime()
  }

  return {
    async list() {
      return Array.from((await load()).values())
    },
    async get(id) {
      const cached = state.loaded ? state.map.get(id) : undefined

      if (cached) return cached

      const record = await readJson<T>(fileOf(id))

      if (record) state.map.set(id, record)

      return record
    },
    async remember(item) {
      state.map.set(item.id, item)
      await refreshMtime()
    },
    async forget(id) {
      state.map.delete(id)
      await refreshMtime()
    },
  }
}
