import 'server-only'

import { globalState } from '../global-state'

const chains = globalState('locks', () => new Map<string, Promise<unknown>>())

/** Serializes work per key. The chain entry is removed when it drains. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve()
  const run = previous.catch(() => {}).then(fn)

  chains.set(key, run)

  try {
    return await run
  } finally {
    if (chains.get(key) === run) chains.delete(key)
  }
}
