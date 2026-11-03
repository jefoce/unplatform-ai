// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { isBoolean } from 'lodash-es'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import { isRecord } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { toggleFavoriteId } from '@/features/history/actions/record-actions'
import { useHistory } from '@/features/history/list/use-history'

import { record } from './helpers/history'

interface VideoFeedServer {
  records: GenerationRecord[]
  patchBodies: boolean[]
  patchGate: Promise<void> | null
}

let server: VideoFeedServer

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function page(current: VideoFeedServer): GenerationListResult {
  return { items: current.records, nextCursor: null, activeCount: 0 }
}

function patchBodyFavorite(init?: RequestInit): boolean {
  const body: unknown = JSON.parse(String(init?.body ?? '{}'))

  if (!isRecord(body) || !isBoolean(body.favorite)) {
    throw new Error('Missing favorite body')
  }

  return body.favorite
}

async function runPatch(current: VideoFeedServer, url: string, isFavorite: boolean) {
  current.patchBodies.push(isFavorite)

  await current.patchGate

  const id = url.split('/').at(-1) ?? ''

  current.records = current.records.map((item) => {
    return item.id === id ? { ...item, favorite: isFavorite } : item
  })

  return jsonResponse(current.records)
}

async function handleFetch(
  current: VideoFeedServer,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if ((init?.method ?? 'GET') === 'PATCH') {
    return runPatch(current, String(input), patchBodyFavorite(init))
  }

  return jsonResponse(page(current))
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  return handleFetch(server, input, init)
})

function deferred() {
  return Promise.withResolvers<void>()
}

function SwrWrapper(props: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => {
          return new Map()
        },
        dedupingInterval: 0,
      }}
    >
      {props.children}
    </SWRConfig>
  )
}

beforeEach(() => {
  server = { records: [], patchBodies: [], patchGate: null }
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('optimistic video favorite', () => {
  it('flips the record before the PATCH resolves, then sends the opposite value after it', async () => {
    server.records = [record('v', { favorite: false })]

    let releasePatch: (() => void) | undefined

    server.patchGate = new Promise<void>((resolve) => {
      releasePatch = resolve
    })

    const { result } = renderHook(
      () => {
        return useHistory()
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const first = toggleFavoriteId('v', false)

    await waitFor(() => {
      expect(result.current.records[0]?.favorite).toBe(true)
    })

    const second = toggleFavoriteId('v', true)

    await waitFor(() => {
      expect(result.current.records[0]?.favorite).toBe(false)
    })

    expect(server.patchBodies).toEqual([true])

    await act(async () => {
      releasePatch?.()
      await Promise.all([first, second])
    })

    expect(server.patchBodies).toEqual([true, false])
    expect(result.current.records[0]?.favorite).toBe(false)
  })

  it('keeps the second click while the first queued PATCH settles', async () => {
    server.records = [record('v', { favorite: false })]

    const firstGate = deferred()
    const secondGate = deferred()

    server.patchGate = firstGate.promise

    const { result } = renderHook(
      () => {
        return useHistory()
      },
      { wrapper: SwrWrapper },
    )

    await waitFor(() => {
      expect(result.current.records).toHaveLength(1)
    })

    const first = toggleFavoriteId('v', false)

    await waitFor(() => {
      expect(result.current.records[0]?.favorite).toBe(true)
    })

    await waitFor(() => {
      expect(server.patchBodies).toEqual([true])
    })

    const second = toggleFavoriteId('v', true)

    await waitFor(() => {
      expect(result.current.records[0]?.favorite).toBe(false)
    })

    server.patchGate = secondGate.promise
    firstGate.resolve()

    await act(async () => {
      await first
    })

    expect(result.current.records[0]?.favorite).toBe(false)

    await act(async () => {
      secondGate.resolve()
      await second
    })

    expect(server.patchBodies).toEqual([true, false])
    expect(result.current.records[0]?.favorite).toBe(false)
  })
})
