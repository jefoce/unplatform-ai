'use client'

import useSWR, { mutate } from 'swr'

import { CREDITS_POLL_MS } from '@/core/constants'
import type { CreditsInfo } from '@/core/types'
import { fetcher } from '@/lib/fetcher'

/** Credits poll. `refresh(true)` bypasses the server cache. */
export function useCredits() {
  const { data, isLoading } = useSWR<CreditsInfo>('/api/credits', fetcher, {
    refreshInterval: CREDITS_POLL_MS,
  })

  return {
    credits: data,
    isLoading,
    refresh: (isFresh = false) => {
      void refreshCredits(isFresh).catch(() => {})
    },
  }
}

/** Revalidates the credits key, optionally asking the server for fresh data. */
export async function refreshCredits(isFresh = false): Promise<void> {
  if (!isFresh) {
    await mutate('/api/credits')

    return
  }

  const data = await fetcher<CreditsInfo>('/api/credits?fresh=1')

  await mutate('/api/credits', data, { revalidate: false })
}
