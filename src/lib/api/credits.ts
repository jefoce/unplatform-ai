'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'
import useSWR, { mutate } from 'swr'

import { CREDITS_FOCUS_STALE_MS, CREDITS_POLL_MS } from '@/core/constants'
import type { CreditsInfo } from '@/core/types'
import { CREDITS_KEY } from '@/lib/api/swr-keys'
import { fetcher } from '@/lib/fetcher'

let lastCredits: CreditsInfo | undefined
let freshRequest: Promise<void> | null = null

/** Picks the payload with the later fetchedAt. A tie keeps the next one. */
export function keepNewestCredits(
  current: CreditsInfo | undefined,
  next: CreditsInfo,
): CreditsInfo {
  if (isNil(current)) {
    return next
  }

  const isNewer = Date.parse(next.fetchedAt) >= Date.parse(current.fetchedAt)

  if (isNewer) {
    return next
  }

  return current
}

/** Fetches credits, keeping an older response out of the cache. */
export async function fetchCredits(): Promise<CreditsInfo> {
  const fetched = await fetcher<CreditsInfo>(CREDITS_KEY)
  const newest = keepNewestCredits(lastCredits, fetched)

  lastCredits = newest

  return newest
}

export interface CreditsState {
  credits: CreditsInfo | undefined
  isLoading: boolean
  refresh: (isFresh?: boolean) => Promise<void>
}

/** Credits poll. `refresh(true)` bypasses the server cache. */
export function useCredits(): CreditsState {
  const { data, isLoading } = useSWR<CreditsInfo>(CREDITS_KEY, fetchCredits, {
    refreshInterval: CREDITS_POLL_MS,
    revalidateOnFocus: false,
  })

  return {
    credits: data,
    isLoading,
    refresh: (isFresh = false) => {
      return refreshCredits(isFresh)
    },
  }
}

/** One focus/visibility listener for every credits consumer. */
export function useCreditsFocusRefresh(): void {
  useEffect(() => {
    const refreshIfStale = (): void => {
      const current = lastCredits

      if (isNil(current)) {
        return
      }

      const age = Date.now() - Date.parse(current.fetchedAt)

      if (age <= CREDITS_FOCUS_STALE_MS) {
        return
      }

      void refreshCredits(true).catch(() => {})
    }

    const handleVisibility = (): void => {
      if (!document.hidden) {
        refreshIfStale()
      }
    }

    window.addEventListener('focus', refreshIfStale)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', refreshIfStale)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}

/** Revalidates the credits key, optionally asking the server for fresh data. */
export function refreshCredits(isFresh = false): Promise<void> {
  if (!isFresh) {
    return mutate(CREDITS_KEY)
  }

  if (!isNil(freshRequest)) {
    return freshRequest
  }

  freshRequest = loadFreshCredits()

  return freshRequest
}

async function loadFreshCredits(): Promise<void> {
  try {
    const fetched = await fetcher<CreditsInfo>(`${CREDITS_KEY}?fresh=1`)
    const newest = keepNewestCredits(lastCredits, fetched)

    lastCredits = newest

    await mutate(CREDITS_KEY, newest, { revalidate: false })
  } finally {
    freshRequest = null
  }
}
