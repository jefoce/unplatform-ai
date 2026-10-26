'use client'

import useSWR, { mutate } from 'swr'

import { fetcher } from '@/lib/fetcher'
import { REMOTE_STATUS_KEY } from '@/lib/swr-keys'

export interface RemoteStatus {
  configured: boolean
  mock: boolean
  storedBytes: number
}

/** Remote storage status, with tracked bytes. Undefined while loading. */
export function useRemoteStatusData(): RemoteStatus | undefined {
  const { data } = useSWR<RemoteStatus>(REMOTE_STATUS_KEY, fetcher, {
    revalidateOnFocus: false,
  })

  return data
}

/** True when R2 or the mock store is configured. Undefined while loading. */
export function useRemoteStatus(): boolean | undefined {
  return useRemoteStatusData()?.configured
}

/** Revalidates the remote status after storage keys change. */
export async function refreshRemoteStatus(): Promise<void> {
  await mutate(REMOTE_STATUS_KEY)
}
