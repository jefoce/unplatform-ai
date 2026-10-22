const MAX_ACTIVE = 2

/** LRU of active player ids, last = newest. Replaced, never mutated in place. */
let active: string[] = []
const listeners = new Set<() => void>()

/**
 * Marks id active, newest last. Evicts the oldest beyond MAX_ACTIVE.
 */
export function acquire(id: string) {
  const next = [...active.filter((x) => x !== id), id]

  while (next.length > MAX_ACTIVE) next.shift()

  const isUnchanged = next.length === active.length && next.every((x, i) => x === active[i])

  if (isUnchanged) return

  active = next
  emit()
}

/** Drops id from the active set, no-op when absent. */
export function release(id: string) {
  if (!active.includes(id)) return

  active = active.filter((x) => x !== id)
  emit()
}

export function isActive(id: string) {
  return active.includes(id)
}

export function subscribe(fn: () => void) {
  listeners.add(fn)

  return () => {
    listeners.delete(fn)
  }
}

export function getSnapshot() {
  return active
}

function emit() {
  for (const fn of listeners) fn()
}
