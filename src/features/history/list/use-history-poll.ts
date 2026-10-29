'use client'

import { useEffect, useRef } from 'react'
import { uniq } from 'lodash-es'

import { HISTORY_POLL_MS } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { ACTIVE_STATUSES, type GenerationListResult } from '@/core/types'
import { fetchGenerationsByIds } from '@/lib/api/generations'

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
    records
      .filter((record) => {
        return ACTIVE_STATUSES.includes(record.status)
      })
      .map((record) => {
        return record.id
      }),
  )
}

function shouldSkipTick(isForced: boolean, lastRunAt: number): boolean {
  return !isForced && document.hidden && Date.now() - lastRunAt < HIDDEN_POLL_MS
}

interface PollState {
  isRunning: boolean
  lastRevalidateAt: number
}

/** Revalidates the loaded pages when an active count has no loaded active id. */
async function revalidateIdleCount(state: PollState): Promise<void> {
  if (Date.now() - state.lastRevalidateAt < HISTORY_POLL_MS * 3) {
    return
  }

  state.lastRevalidateAt = Date.now()
  state.isRunning = true

  try {
    await revalidateHistory()
  } catch {
    // Next tick retries, polling does not surface transient errors.
  } finally {
    state.isRunning = false
  }
}

/** One ids request per tick while any loaded record is active. */
export function useHistoryPoll(params: HistoryPollParams): void {
  const { activeCount, records, mutate } = params
  const recordsRef = useRef(records)

  useEffect(() => {
    recordsRef.current = records
  }, [records])

  useEffect(() => {
    if (activeCount <= 0) {
      return
    }

    let isStopped = false
    let lastRunAt = 0
    const state: PollState = { isRunning: false, lastRevalidateAt: Date.now() }

    const tick = async (isForced = false) => {
      if (state.isRunning || shouldSkipTick(isForced, lastRunAt)) {
        return
      }

      lastRunAt = Date.now()
      const ids = activeIds(recordsRef.current)

      if (ids.length === 0) {
        await revalidateIdleCount(state)

        return
      }

      state.isRunning = true

      try {
        const result = await fetchGenerationsByIds(ids)

        if (isStopped) {
          return
        }

        if (result.items.length < ids.length) {
          void revalidateHistory()
        } // some ids no longer exist

        if (result.items.length === 0) {
          return
        }

        const byId = new Map(
          result.items.map((record) => {
            return [record.id, record]
          }),
        )

        await mutate((pages) => {
          return pages?.map((page) => {
            return patchPage({ page, byId, activeCount: result.activeCount })
          })
        }, false)
      } catch {
        // Next tick retries, polling does not surface transient errors.
      } finally {
        state.isRunning = false
      }
    }

    const onVisible = () => {
      if (!document.hidden) {
        void tick(true)
      }
    }

    void tick()

    const timer = window.setInterval(() => {
      return void tick()
    }, HISTORY_POLL_MS)

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      isStopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeCount, mutate])
}
