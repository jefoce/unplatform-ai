'use client'

import useSWR from 'swr'

import { fetcher } from '@/lib/fetcher'
import { REMOTE_STATUS_KEY } from '@/lib/swr-keys'

interface RemoteStatus {
  configured: boolean
  mock: boolean
}

/** True when R2 or the mock store is configured. Undefined while loading. */
export function useRemoteStatus(): boolean | undefined {
  const { data } = useSWR<RemoteStatus>(REMOTE_STATUS_KEY, fetcher, {
    revalidateOnFocus: false,
  })

  return data?.configured
}
