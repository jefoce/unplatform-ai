import 'server-only'

/** One process-wide singleton slot that survives duplicate module instances. */
export function globalState<T>(key: string, init: () => T): T {
  const host = globalThis as Record<string, unknown>
  const name = `__upai_${key}`

  return (host[name] ??= init()) as T
}
