import { isNonEmptyString } from '@/core/guards'

/**
 * Preloads poster images so the next item paints from cache.
 * @public
 */
export function preloadPosters(sources: (string | undefined | null)[]): void {
  if (typeof window === 'undefined') {
    return
  }

  for (const source of sources) {
    if (!isNonEmptyString(source)) {
      continue
    }

    new Image().src = source
  }
}
