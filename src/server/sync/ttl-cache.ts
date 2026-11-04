import 'server-only'

import { isNil } from 'lodash-es'

import { globalState } from '../global-state'

export interface TtlCacheOptions {
  key: string
  okTtlMs: number
  failTtlMs: number
}

export interface TtlLoadResult<T> {
  value: T
  isOk: boolean
}

export type TtlLoader<T> = (previous: T | undefined) => Promise<TtlLoadResult<T>>

export interface TtlCache<T> {
  get(id: string, load: TtlLoader<T>, isForce?: boolean): Promise<T>
  clear(): void
}

interface TtlCacheEntry<T> {
  value: T
  expiresAt: number
}

interface TtlCacheState<T> {
  entries: Map<string, TtlCacheEntry<T>>
  pending: Map<string, Promise<T>>
  version: Map<string, number>
  epoch: number
}

interface RunLoadParams<T> {
  id: string
  load: TtlLoader<T>
  version: number
}

/** Caches loaded values by id, with a shorter window for failed loads. */
export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const { key, okTtlMs, failTtlMs } = options

  const state = globalState<TtlCacheState<T>>(`${key}:cache`, () => {
    return { entries: new Map(), pending: new Map(), version: new Map(), epoch: 0 }
  })

  // eslint-disable-next-line @typescript-eslint/max-params -- fixed TtlCache signature
  async function get(id: string, load: TtlLoader<T>, isForce = false): Promise<T> {
    const cached = state.entries.get(id)

    if (!isForce && !isNil(cached) && Date.now() < cached.expiresAt) {
      return cached.value
    }

    const running = state.pending.get(id)

    // A forced get never joins an older load. It starts its own.
    if (!isForce && !isNil(running)) {
      return running
    }

    return track(id, start(id, load))
  }

  function start(id: string, load: TtlLoader<T>): Promise<T> {
    const version = (state.version.get(id) ?? 0) + 1

    state.version.set(id, version)

    return runLoad({ id, load, version })
  }

  function track(id: string, next: Promise<T>): Promise<T> {
    state.pending.set(id, next)

    return next.finally(() => {
      if (state.pending.get(id) === next) {
        state.pending.delete(id)
      }
    })
  }

  async function runLoad(params: RunLoadParams<T>): Promise<T> {
    const { id, load, version } = params
    const { epoch } = state
    const result = await load(state.entries.get(id)?.value)

    // A clear() or a newer load means this result must reach the caller but not the cache.
    if (state.epoch !== epoch || state.version.get(id) !== version) {
      return result.value
    }

    const ttlMs = result.isOk ? okTtlMs : failTtlMs

    state.entries.set(id, { value: result.value, expiresAt: Date.now() + ttlMs })

    return result.value
  }

  function clear(): void {
    state.epoch += 1
    state.entries.clear()
    state.pending.clear()
    state.version.clear()
  }

  return { get, clear }
}
