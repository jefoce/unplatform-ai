import type { GenerationListResult } from '@/core/api/video'

import { createFeedCache, type FeedMutate } from './feed-cache'

export type HistoryFeedMutate = FeedMutate<GenerationListResult>

const cache = createFeedCache<GenerationListResult>()

/** Registers a mounted video feed; the returned function unregisters it. */
export function registerHistoryFeed(mutate: HistoryFeedMutate): () => void {
  return cache.register(mutate)
}

/** Reads every mounted video feed's loaded pages without a refetch. */
export function readHistoryFeedPages(): Promise<GenerationListResult[][]> {
  return cache.read()
}

/** Revalidates every mounted video feed. */
export function refreshHistoryFeeds(): Promise<unknown> {
  return cache.refresh()
}

/** Patches every mounted video feed without a refetch. */
export function patchHistoryFeeds(
  update: (pages: GenerationListResult[]) => GenerationListResult[],
): Promise<unknown> {
  return cache.patch(update)
}
