import 'server-only'

/** Message from a caught value, with a fallback for non-errors. */
export function messageOf(error: unknown, fallback = 'Request failed'): string {
  return error instanceof Error ? error.message : fallback
}
