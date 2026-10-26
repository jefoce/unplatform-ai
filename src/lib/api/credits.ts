'use client'

import useSWR, { mutate } from 'swr'

import { CREDITS_POLL_MS } from '@/core/constants'
import type { CreditsInfo } from '@/core/types'
import { fetcher } from '@/lib/fetcher'
import { CREDITS_KEY } from '@/lib/swr-keys'

export function fetchCredits(): Promise<CreditsInfo> {
  return fetcher<CreditsInfo>(CREDITS_KEY)
}

export interface CreditsState {
  credits: CreditsInfo | undefined
  isLoading: boolean
  refresh: (isFresh?: boolean) => void
}

/** Credits poll. `refresh(true)` bypasses the server cache. */
export function useCredits(): CreditsState {
  const { data, isLoading } = useSWR<CreditsInfo>(CREDITS_KEY, fetchCredits, {
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
    await mutate(CREDITS_KEY)

    return
  }

  const data = await fetcher<CreditsInfo>(`${CREDITS_KEY}?fresh=1`)

  await mutate(CREDITS_KEY, data, { revalidate: false })
}
