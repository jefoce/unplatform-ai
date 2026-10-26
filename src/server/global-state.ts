import 'server-only'

import type { Dict } from '@/core/utility-types'

/** One process-wide singleton slot that survives duplicate module instances. */
export function globalState<T>(key: string, init: () => T): T {
  const host = globalThis as Dict<unknown>
  const name = `__upai_${key}`

  return (host[name] ??= init()) as T
}
