import { isEmpty, isPlainObject, isString } from 'lodash-es'

import type { Dict } from './utility-types'

/** Narrows unknown JSON-like data to a plain object. */
export function isRecord(value: unknown): value is Dict<unknown> {
  return isPlainObject(value)
}

/** Narrows a value to a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && !isEmpty(value)
}

/** Narrows a value to a member of the list. */
export function isOneOf<const T extends readonly string[]>(
  list: T,
  value: unknown,
): value is T[number] {
  return isString(value) && list.includes(value)
}

/** Narrows a string key to one the object declares. */
export function isKeyOf<T extends object>(record: T, key: string): key is keyof T & string {
  return key in record
}
