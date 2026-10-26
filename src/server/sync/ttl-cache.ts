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
  epoch: number
}

/** Caches loaded values by id, with a shorter window for failed loads. */
export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const { key, okTtlMs, failTtlMs } = options

  const state = globalState<TtlCacheState<T>>(`${key}:cache`, () => {
    return { entries: new Map(), pending: new Map(), epoch: 0 }
  })

  // eslint-disable-next-line @typescript-eslint/max-params -- fixed TtlCache signature
  async function get(id: string, load: TtlLoader<T>, isForce = false): Promise<T> {
    const cached = state.entries.get(id)

    if (!isForce && !isNil(cached) && Date.now() < cached.expiresAt) {
      return cached.value
    }

    const running = state.pending.get(id)

    if (!isNil(running)) {
      return running
    }

    return track(id, runLoad(id, load))
  }

  function track(id: string, next: Promise<T>): Promise<T> {
    state.pending.set(id, next)

    return next.finally(() => {
      if (state.pending.get(id) === next) {
        state.pending.delete(id)
      }
    })
  }

  async function runLoad(id: string, load: TtlLoader<T>): Promise<T> {
    const { epoch } = state
    const result = await load(state.entries.get(id)?.value)

    // A clear() during the load means its inputs changed. The caller gets the result, the cache does not.
    if (state.epoch !== epoch) {
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
  }

  return { get, clear }
}
