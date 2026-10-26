/** Message from a caught value, with a fallback for non-errors. */
export function messageOf(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
