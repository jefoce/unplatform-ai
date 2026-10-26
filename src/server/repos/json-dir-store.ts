import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

import type { HasId } from '@/core/utility-types'

import { listJsonFileNames, readJson } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { globalState } from '../global-state'

interface IndexState<T> {
  map: Map<string, T>
  dirMtimeMs: number
  loaded: boolean
}

export interface JsonDirStore<T extends HasId> {
  list(): Promise<T[]>
  get(id: string): Promise<T | null>
  remember(item: T): Promise<void>
  forget(id: string): Promise<void>
}

interface JsonDirStoreParams<T> {
  key: string
  dir: string
  fileOf: (id: string) => string
  schema: ZodType<T>
}

/** Indexes `<id>.json` files in one directory, reloading when its mtime changes. */
export function jsonDirStore<T extends HasId>(params: JsonDirStoreParams<T>): JsonDirStore<T> {
  const { key, dir, fileOf, schema } = params

  const state = globalState<IndexState<T>>(key, () => {
    return {
      map: new Map(),
      dirMtimeMs: -1,
      loaded: false,
    }
  })

  const dirMtime = (): Promise<number> => {
    return fs.stat(dir).then(
      (stats) => {
        return stats.mtimeMs
      },
      () => {
        return 0
      },
    )
  }

  async function load(): Promise<Map<string, T>> {
    const mtimeMs = await dirMtime()

    if (state.loaded && state.dirMtimeMs === mtimeMs) {
      return state.map
    }

    const names = (await listJsonFileNames(dir)).filter((name) => {
      return isUuid(path.basename(name, '.json'))
    })

    const records: (T | null)[] = await Promise.all(
      names.map((name) => {
        return readJson(path.join(dir, name), schema)
      }),
    )

    state.map = new Map(
      records
        .filter((record): record is T => {
          return !isNil(record)
        })
        .map((record) => {
          return [record.id, record]
        }),
    )

    state.dirMtimeMs = mtimeMs
    state.loaded = true

    return state.map
  }

  async function refreshMtime(): Promise<void> {
    if (!state.loaded) {
      return
    }

    state.dirMtimeMs = await dirMtime()
  }

  return {
    async list() {
      return Array.from((await load()).values())
    },
    async get(id) {
      const map = state.loaded ? state.map : null
      const cached = map?.get(id)

      if (cached) {
        return cached
      }

      const record = await readJson(fileOf(id), schema)

      if (record) {
        state.map.set(id, record)
      }

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
