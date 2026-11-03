// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshRemoteStatus, useRemoteStatusData } from '@/lib/api/remote'

const fetchStatus = vi.hoisted(() => {
  return vi.fn(async (_input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ configured: false, mock: false, storedBytes: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 0,
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

beforeEach(() => {
  fetchStatus.mockClear()
  vi.stubGlobal('fetch', fetchStatus)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('refreshRemoteStatus', () => {
  it('revalidates the mounted remote status query', async () => {
    const { result } = renderHook(
      () => {
        return useRemoteStatusData()
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current).toEqual({ configured: false, mock: false, storedBytes: 0 })
    })

    expect(fetchStatus).toHaveBeenCalledTimes(1)

    await refreshRemoteStatus()

    await waitFor(() => {
      expect(fetchStatus).toHaveBeenCalledTimes(2)
    })

    expect(String(fetchStatus.mock.calls[0]?.[0])).toBe('/api/remote/status')
  })
})
