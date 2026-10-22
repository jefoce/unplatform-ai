/** Message safe to show in a toast, with a custom fallback. */
export function errorMessage(error: unknown, fallback = 'Request failed'): string {
  return error instanceof Error ? error.message : fallback
}
