import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

interface LocalRead<T> {
  // False when storage is unavailable (SSR, private mode, denied access).
  ok: boolean
  value: T | null
}

/**
 * Reads a JSON value and validates it with `schema`.
 * Parse and schema failures return `{ ok: true, value: null }`.
 */
export function readLocal<T>(key: string, schema: ZodType<T>): LocalRead<T> {
  if (typeof window === 'undefined') return { ok: false, value: null }

  let raw: string | null

  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return { ok: false, value: null }
  }

  if (isNil(raw)) return { ok: true, value: null }

  try {
    const parsed: unknown = JSON.parse(raw)
    const result = schema.safeParse(parsed)

    return { ok: true, value: result.success ? result.data : null }
  } catch {
    return { ok: true, value: null }
  }
}

/** Writes a JSON value. Quota and private-mode failures are ignored. */
export function writeLocal(key: string, value: unknown): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable or full.
  }
}
