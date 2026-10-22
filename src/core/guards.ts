import { isPlainObject } from 'lodash-es'

/** Narrows unknown JSON-like data to a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value)
}
