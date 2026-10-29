import { isNonEmptyString } from './guards'

/** App version inlined by Next from package.json, null when absent or empty. */
export function appVersion(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_VERSION

  if (!isNonEmptyString(value)) {
    return null
  }

  return value
}
