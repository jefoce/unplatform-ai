'use client'

import { useEffect, useRef } from 'react'
import { countBy, isNil } from 'lodash-es'
import { toast } from 'sonner'
import { z } from 'zod'

import { HISTORY_SCROLL_DELAY_MS } from '@/core/constants'
import type { GridItemStatus } from '@/core/feed/grid-item'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord, JobStatus } from '@/core/schemas/generation-record'
import type { ImageRecord, ImageRecordStatus } from '@/core/schemas/image-record'
import { canonicalPrompt } from '@/lib/feed/output-items'
import { truncate } from '@/lib/format'
import { readLocal, writeLocal } from '@/lib/local-store'
import { getPlatform } from '@/lib/platform'

import { useHistoryViewStore } from '../list/view-store'
import { useCreditsAfterJob } from './use-credits-after-job'

interface JobNotificationParams {
  records: GenerationRecord[]
  imageRecords: ImageRecord[]
  activeCount: number
  isLoading: boolean
}

const LAST_SEEN_KEY = 'unplatform-ai:lastSeenAt'
const LAST_SEEN_VALUE = z.string()
const SUMMARY_STATUSES: JobStatus[] = ['completed', 'expired', 'failed']
const IMAGE_READY_STATUSES: ImageRecordStatus[] = ['completed', 'partial']

type NotificationKind = 'image' | 'video'

type FailureTitles = Partial<Record<GridItemStatus, string>>

const FAILED_TITLES: Record<NotificationKind, FailureTitles> = {
  video: {
    failed: 'Generation failed',
    cancelled: 'Generation cancelled',
    expired: 'Generation expired',
  },
  image: {
    failed: 'Image failed',
    cancelled: 'Image cancelled',
    expired: 'Image expired',
  },
}

interface NotifyFailureParams {
  kind: NotificationKind
  status: GridItemStatus
  description: string
}

/** Toasts the failure title shared by both generators, when that kind has one. */
export function notifyFailure(params: NotifyFailureParams): void {
  const { kind, status, description } = params
  const title = FAILED_TITLES[kind][status]

  if (isNil(title)) {
    return
  }

  toast.error(title, { description })
}

function scrollToRecord(id: string): void {
  document
    .getElementById(`history-item-${id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function readLastSeen(): number | null {
  const value = readLocal(LAST_SEEN_KEY, LAST_SEEN_VALUE).value

  if (!isNonEmptyString(value)) {
    return null
  }

  const at = Date.parse(value)

  if (Number.isFinite(at)) {
    return at
  }

  return null
}

const pluralVideos = (count: number): string => {
  const word = count === 1 ? 'video' : 'videos'

  return `${count} ${word}`
}

function summaryText(records: GenerationRecord[]): string {
  const counts = countBy(records, 'status')
  const completed = counts.completed ?? 0
  const expired = counts.expired ?? 0
  const failed = counts.failed ?? 0
  const parts: string[] = []

  if (completed > 0) {
    const verb = completed === 1 ? 'is' : 'are'

    parts.push(
      `${pluralVideos(completed)} finished while the app was closed and ${verb} downloading.`,
    )
  }

  if (expired > 0) {
    const pronoun = expired === 1 ? 'it' : 'they'

    parts.push(`${pluralVideos(expired)} expired before ${pronoun} could be downloaded.`)
  }

  if (failed > 0) {
    parts.push(`${pluralVideos(failed)} failed while the app was closed.`)
  }

  return parts.join(' ')
}

/** Scrolls to history and applies its status bucket, ids are not a server filter. */
function showChanges(records: GenerationRecord[]): void {
  const store = useHistoryViewStore.getState()

  store.resetFilters()

  const buckets = new Set(
    records.map((record) => {
      const bucket = record.status === 'completed' ? 'done' : 'failed'

      return bucket
    }),
  )

  if (buckets.size === 1) {
    store.setFilters({ status: buckets.values().next().value })
  }

  document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const first = records.at(0)

  if (!isNil(first)) {
    window.setTimeout(() => {
      scrollToRecord(first.id)
    }, HISTORY_SCROLL_DELAY_MS)
  }
}

function notifyHidden(title: string, body: string): void {
  if (document.visibilityState !== 'hidden') {
    return
  }

  void getPlatform()
    .then((platform) => {
      return platform.notify(title, body)
    })
    .catch(() => {})
}

function notifyVideoChanges(before: Map<string, JobStatus>, records: GenerationRecord[]): void {
  for (const record of records) {
    const previousStatus = before.get(record.id)

    if (isNil(previousStatus) || previousStatus === record.status) {
      continue
    }

    const body = truncate(canonicalPrompt(record), 80)

    if (record.status === 'completed') {
      toast.success('Video ready', {
        description: body,
        action: {
          label: 'Show',
          onClick: () => {
            scrollToRecord(record.id)
          },
        },
      })

      notifyHidden('Video ready', body)
    }

    notifyFailure({ kind: 'video', status: record.status, description: record.error ?? body })
  }
}

function notifyImageChanges(before: Map<string, ImageRecordStatus>, records: ImageRecord[]): void {
  for (const record of records) {
    const previousStatus = before.get(record.id)

    if (isNil(previousStatus) || previousStatus === record.status) {
      continue
    }

    const body = truncate(record.input.prompt, 80)

    if (IMAGE_READY_STATUSES.includes(record.status)) {
      toast.success('Image ready', { description: body })
      notifyHidden('Image ready', body)
    }

    notifyFailure({ kind: 'image', status: record.status, description: record.error ?? body })
  }
}

/** Toasts for status transitions, hidden-tab notifications and the tab title. */
export function useJobNotifications(params: JobNotificationParams): void {
  const { records, imageRecords, activeCount, isLoading } = params
  const previous = useRef<Map<string, JobStatus> | null>(null)
  const previousImages = useRef<Map<string, ImageRecordStatus> | null>(null)
  const baseTitle = useRef<string | null>(null)
  const summaryChecked = useRef(false)

  useCreditsAfterJob({ records, imageRecords })

  useEffect(() => {
    baseTitle.current ??= document.title
    const title = baseTitle.current

    return () => {
      if (title !== '') {
        document.title = title
      }
    }
  }, [])

  useEffect(() => {
    const title =
      activeCount > 0 ? `(${activeCount}) Generating \u00b7 Unplatform AI` : 'Unplatform AI'

    document.title = title
  }, [activeCount])

  useEffect(() => {
    if (summaryChecked.current || isLoading) {
      return
    }

    summaryChecked.current = true
    const lastSeen = readLastSeen()

    writeLocal(LAST_SEEN_KEY, new Date().toISOString())

    if (isNil(lastSeen)) {
      return
    }

    const changes = records.filter((record) => {
      return SUMMARY_STATUSES.includes(record.status) && Date.parse(record.updatedAt) > lastSeen
    })

    if (changes.length === 0) {
      return
    }

    toast(summaryText(changes), {
      duration: 10_000,
      action: {
        label: 'Show',
        onClick: () => {
          showChanges(changes)
        },
      },
    })
  }, [isLoading, records])

  useEffect(() => {
    const before = previousImages.current

    previousImages.current = new Map(
      imageRecords.map((record) => {
        return [record.id, record.status]
      }),
    )

    if (!isNil(before)) {
      notifyImageChanges(before, imageRecords)
    }
  }, [imageRecords])

  useEffect(() => {
    const before = previous.current

    previous.current = new Map(
      records.map((record) => {
        return [record.id, record.status]
      }),
    )

    if (!isNil(before)) {
      notifyVideoChanges(before, records)
    }
  }, [records])
}
