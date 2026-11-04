'use client'

import { useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'

import { CREDITS_FOLLOWUP_DELAYS_MS, CREDITS_SETTLE_WINDOW_MS } from '@/core/constants'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import type { ImageRecord, ImageRecordStatus } from '@/core/schemas/image-record'
import { refreshCredits } from '@/lib/api/credits'

const SETTLED_STATUSES: (JobStatus | ImageRecordStatus)[] = [
  'completed',
  'partial',
  'failed',
  'expired',
]

type TimeoutId = ReturnType<typeof setTimeout>

interface CreditsAfterJobParams {
  records: GenerationRecord[]
  imageRecords: ImageRecord[]
}

interface SettledRecord {
  id: string
  status: JobStatus | ImageRecordStatus
  updatedAt: string
}

function isWithinSettleWindow(record: SettledRecord, now: number): boolean {
  const updatedAt = Date.parse(record.updatedAt)

  if (!Number.isFinite(updatedAt)) {
    return false
  }

  return now - updatedAt <= CREDITS_SETTLE_WINDOW_MS
}

/** A status change into a settled one, or a settled record that first appeared recently. */
function didSettle(
  before: ReadonlyMap<string, JobStatus | ImageRecordStatus>,
  records: SettledRecord[],
): boolean {
  const now = Date.now()

  return records.some((record) => {
    if (!SETTLED_STATUSES.includes(record.status)) {
      return false
    }

    const previousStatus = before.get(record.id)

    if (isNil(previousStatus)) {
      return isWithinSettleWindow(record, now)
    }

    return previousStatus !== record.status
  })
}

/** One fresh credits fetch per tick when jobs finish, plus a settle follow-up. */
export function useCreditsAfterJob(params: CreditsAfterJobParams): void {
  const { records, imageRecords } = params
  const previousVideos = useRef<Map<string, JobStatus | ImageRecordStatus> | null>(null)
  const previousImages = useRef<Map<string, JobStatus | ImageRecordStatus> | null>(null)
  const settleTimers = useRef<TimeoutId[]>([])

  useEffect(() => {
    const beforeVideos = previousVideos.current
    const beforeImages = previousImages.current

    previousVideos.current = new Map(
      records.map((record) => {
        return [record.id, record.status]
      }),
    )

    previousImages.current = new Map(
      imageRecords.map((record) => {
        return [record.id, record.status]
      }),
    )

    const didSettleNow =
      (!isNil(beforeVideos) && didSettle(beforeVideos, records)) ||
      (!isNil(beforeImages) && didSettle(beforeImages, imageRecords))

    if (!didSettleNow) {
      return
    }

    for (const timer of settleTimers.current) {
      clearTimeout(timer)
    }

    settleTimers.current = []

    for (const delay of CREDITS_FOLLOWUP_DELAYS_MS) {
      if (delay === 0) {
        void refreshCredits(true).catch(() => {})

        continue
      }

      const timer = setTimeout(() => {
        void refreshCredits(true).catch(() => {})
      }, delay)

      settleTimers.current.push(timer)
    }
  }, [records, imageRecords])

  useEffect(() => {
    return () => {
      for (const timer of settleTimers.current) {
        clearTimeout(timer)
      }
    }
  }, [])
}
