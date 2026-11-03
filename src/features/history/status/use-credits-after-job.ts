'use client'

import { useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'

import { CREDITS_SETTLE_MS } from '@/core/constants'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import type { ImageRecord, ImageRecordStatus } from '@/core/schemas/image-record'
import { refreshCredits } from '@/lib/api/credits'

const VIDEO_SETTLED_STATUSES: JobStatus[] = ['completed', 'failed', 'expired']
const IMAGE_SETTLED_STATUSES: ImageRecordStatus[] = ['completed', 'partial', 'failed']

type TimeoutId = ReturnType<typeof setTimeout>

interface CreditsAfterJobParams {
  records: GenerationRecord[]
  imageRecords: ImageRecord[]
}

function didSettleVideo(before: Map<string, JobStatus>, records: GenerationRecord[]): boolean {
  return records.some((record) => {
    const previousStatus = before.get(record.id)

    return (
      !isNil(previousStatus) &&
      previousStatus !== record.status &&
      VIDEO_SETTLED_STATUSES.includes(record.status)
    )
  })
}

function didSettleImage(before: Map<string, ImageRecordStatus>, records: ImageRecord[]): boolean {
  return records.some((record) => {
    const previousStatus = before.get(record.id)

    return (
      !isNil(previousStatus) &&
      previousStatus !== record.status &&
      IMAGE_SETTLED_STATUSES.includes(record.status)
    )
  })
}

/** One fresh credits fetch per tick when jobs finish, plus a settle follow-up. */
export function useCreditsAfterJob(params: CreditsAfterJobParams): void {
  const { records, imageRecords } = params
  const previousVideos = useRef<Map<string, JobStatus> | null>(null)
  const previousImages = useRef<Map<string, ImageRecordStatus> | null>(null)
  const settleTimer = useRef<TimeoutId | undefined>(undefined)

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

    const didSettle =
      (!isNil(beforeVideos) && didSettleVideo(beforeVideos, records)) ||
      (!isNil(beforeImages) && didSettleImage(beforeImages, imageRecords))

    if (!didSettle) {
      return
    }

    void refreshCredits(true).catch(() => {})

    if (!isNil(settleTimer.current)) {
      clearTimeout(settleTimer.current)
    }

    settleTimer.current = setTimeout(() => {
      settleTimer.current = undefined
      void refreshCredits(true).catch(() => {})
    }, CREDITS_SETTLE_MS)
  }, [records, imageRecords])

  useEffect(() => {
    return () => {
      if (!isNil(settleTimer.current)) {
        clearTimeout(settleTimer.current)
      }
    }
  }, [])
}
