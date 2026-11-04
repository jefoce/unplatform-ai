// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CREDITS_FOLLOWUP_DELAYS_MS,
  CREDITS_SETTLE_MS,
  CREDITS_SETTLE_WINDOW_MS,
} from '@/core/constants'
import { useCreditsAfterJob } from '@/features/history/status/use-credits-after-job'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import type { ImageRecord } from '../src/core/schemas/image-record'
import { storedRecord } from './helpers/stored-record'

const fetchMock = vi.fn((_url: string) => {
  return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
})

interface CreditsAfterJobProps {
  records: GenerationRecord[]
  imageRecords: ImageRecord[]
}

function renderCredits(initialProps: CreditsAfterJobProps) {
  return renderHook(
    (props: CreditsAfterJobProps) => {
      useCreditsAfterJob(props)
    },
    { initialProps },
  )
}

async function flush(): Promise<void> {
  await act(async () => {})
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('credits follow-up after a settle', () => {
  it('refreshes at 0, 15, 45 and 120 s after a settle', async () => {
    vi.useFakeTimers()

    const { rerender } = renderCredits({
      records: [storedRecord('video-1', { status: 'in_progress' })],
      imageRecords: [],
    })

    await flush()

    rerender({
      records: [storedRecord('video-1', { status: 'completed' })],
      imageRecords: [],
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [zero, first, second, third] = CREDITS_FOLLOWUP_DELAYS_MS

    expect(zero).toBe(0)
    expect(first).toBe(CREDITS_SETTLE_MS)

    await advance(first - zero)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await advance(second - first)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await advance(third - second)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('restarts the follow-up schedule on a new settle', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { rerender } = renderCredits({
      records: [storedRecord('video-1', { status: 'in_progress' })],
      imageRecords: [],
    })

    await flush()

    rerender({
      records: [storedRecord('video-1', { status: 'completed' })],
      imageRecords: [],
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await advance(5000)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender({
      records: [
        storedRecord('video-1', { status: 'completed' }),
        storedRecord('video-2', { status: 'completed', updatedAt: new Date().toISOString() }),
      ],
      imageRecords: [],
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)

    await advance(10_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)

    await advance(5000)

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('credits refresh for a newly seen settle', () => {
  it('refreshes when a settled record first appears in the snapshot', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { rerender } = renderCredits({ records: [], imageRecords: [] })

    await flush()

    rerender({
      records: [
        storedRecord('video-1', { status: 'completed', updatedAt: new Date().toISOString() }),
      ],
      imageRecords: [],
    })

    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ignores a newly seen settled record older than the settle window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { rerender } = renderCredits({ records: [], imageRecords: [] })

    await flush()

    rerender({
      records: [
        storedRecord('video-1', {
          status: 'completed',
          updatedAt: new Date(Date.now() - CREDITS_SETTLE_WINDOW_MS - 1).toISOString(),
        }),
      ],
      imageRecords: [],
    })

    await flush()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
