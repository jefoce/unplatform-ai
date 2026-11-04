'use client'

import { cancelGrace } from '@/features/shared/cancel-grace'
import { cancelGenerationRequest } from '@/lib/api/generations'
import { refreshHistoryFeeds } from '@/lib/history-feed-refresh'

/** Cancels a generation still inside the submit grace window. */
export function cancelGeneration(id: string): Promise<void> {
  return cancelGrace({
    request: () => {
      return cancelGenerationRequest(id)
    },
    refresh: refreshHistoryFeeds,
    successText: 'Generation cancelled',
  })
}
