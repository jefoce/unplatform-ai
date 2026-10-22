'use client'

import { useEffect, useRef } from 'react'
import { uniq } from 'lodash-es'

import { HISTORY_POLL_MS } from '@/core/constants'
import { ACTIVE_STATUSES, type GenerationListResult, type GenerationRecord } from '@/core/types'
import { fetcher } from '@/lib/fetcher'

import { patchPage, revalidateHistory } from './history-pages'

const HIDDEN_POLL_MS = 15_000

interface HistoryPagesMutator {
  (
    updater: (pages?: GenerationListResult[]) => GenerationListResult[] | undefined,
    shouldRevalidate: boolean,
  ): Promise<GenerationListResult[] | undefined>
}

interface HistoryPollParams {
  activeCount: number
  records: GenerationRecord[]
  mutate: HistoryPagesMutator
}

function activeIds(records: GenerationRecord[]): string[] {
  return uniq(
    records.filter((record) => ACTIVE_STATUSES.includes(record.status)).map((record) => record.id),
  )
}

function shouldSkipTick(isForced: boolean, lastRunAt: number): boolean {
  return !isForced && document.hidden && Date.now() - lastRunAt < HIDDEN_POLL_MS
}

/** One ids request per tick while any loaded record is active. */
export function useHistoryPoll(params: HistoryPollParams): void {
  const { activeCount, records, mutate } = params
  const recordsRef = useRef(records)

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  useEffect(() => {
    if (activeCount <= 0) return

    let isStopped = false
    let isRunning = false
    let lastRunAt = 0

    const tick = async (isForced = false) => {
      if (isRunning || shouldSkipTick(isForced, lastRunAt)) return

      lastRunAt = Date.now()
      const ids = activeIds(recordsRef.current)

      if (ids.length === 0) return

      isRunning = true

      try {
        const result = await fetcher<GenerationListResult>(
          `/api/generations?ids=${ids.map(encodeURIComponent).join(',')}`,
        )

        if (isStopped) return

        if (result.items.length < ids.length) void revalidateHistory() // some ids no longer exist
        if (result.items.length === 0) return

        const byId = new Map(result.items.map((record) => [record.id, record]))

        await mutate(
          (pages) =>
            pages?.map((page) => patchPage({ page, byId, activeCount: result.activeCount })),
          false,
        )
      } catch {
        // Next tick retries, polling does not surface transient errors.
      } finally {
        isRunning = false
      }
    }

    const onVisible = () => {
      if (!document.hidden) void tick(true)
    }

    void tick()
    const timer = window.setInterval(() => void tick(), HISTORY_POLL_MS)

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      isStopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeCount, mutate])
}
