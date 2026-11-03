import type { ImageListResult } from '@/core/api/image'

import { createFeedCache, type FeedMutate } from './feed-cache'

export type ImageFeedMutate = FeedMutate<ImageListResult>

const cache = createFeedCache<ImageListResult>()

/** Registers a mounted image feed; the returned function unregisters it. */
export function registerImageFeed(mutate: ImageFeedMutate): () => void {
  return cache.register(mutate)
}

/** Reads every mounted image feed's loaded pages without a refetch. */
export function readImageFeedPages(): Promise<ImageListResult[][]> {
  return cache.read()
}

/** Revalidates every mounted image feed. */
export function refreshImages(): Promise<unknown> {
  return cache.refresh()
}

/** Patches every mounted image feed without a refetch. */
export function patchImageFeeds(
  update: (pages: ImageListResult[]) => ImageListResult[],
): Promise<unknown> {
  return cache.patch(update)
}
