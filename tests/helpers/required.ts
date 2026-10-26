import { isNil } from 'lodash-es'

/** Returns the value or throws, so tests fail with the missing element's name. */
export function required<T>(value: T | null | undefined, label: string): T {
  if (isNil(value)) {
    throw new Error(`Missing ${label}`)
  }

  return value
}
