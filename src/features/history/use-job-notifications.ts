'use client'

import { useEffect, useRef } from 'react'
import { countBy, isNil } from 'lodash-es'
import { toast } from 'sonner'
import { z } from 'zod'

import { HISTORY_SCROLL_DELAY_MS } from '@/core/constants'
import type { GenerationRecord, JobStatus } from '@/core/types'
import { truncate } from '@/lib/format'
import { readLocal, writeLocal } from '@/lib/local-store'
import { getPlatform } from '@/lib/platform'

import { plainPrompt } from './record-view'
import { useHistoryViewStore } from './view-store'

interface JobNotificationParams {
  records: GenerationRecord[]
  activeCount: number
  isLoading: boolean
}

const LAST_SEEN_KEY = 'unplatform-ai:lastSeenAt'
const LAST_SEEN_VALUE = z.string()
const SUMMARY_STATUSES: JobStatus[] = ['completed', 'expired', 'failed']

const FAILED_TITLES: Partial<Record<JobStatus, string>> = {
  failed: 'Generation failed',
  cancelled: 'Generation cancelled',
  expired: 'Generation expired',
}

function scrollToRecord(id: string): void {
  document
    .getElementById(`history-item-${id}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function readLastSeen(): number | null {
  const value = readLocal(LAST_SEEN_KEY, LAST_SEEN_VALUE).value

  if (isNil(value) || value === '') return null

  const at = Date.parse(value)

  return Number.isFinite(at) ? at : null
}

const pluralVideos = (count: number): string => `${count} ${count === 1 ? 'video' : 'videos'}`

function summaryText(records: GenerationRecord[]): string {
  const counts = countBy(records, 'status')
  const parts: string[] = []

  if (counts.completed > 0) {
    parts.push(
      `${pluralVideos(counts.completed)} finished while the app was closed and ${
        counts.completed === 1 ? 'is' : 'are'
      } downloading.`,
    )
  }

  if (counts.expired > 0) {
    parts.push(
      `${pluralVideos(counts.expired)} expired before ${
        counts.expired === 1 ? 'it' : 'they'
      } could be downloaded.`,
    )
  }

  if (counts.failed > 0)
    parts.push(`${pluralVideos(counts.failed)} failed while the app was closed.`)

  return parts.join(' ')
}

/** Scrolls to history and applies its status bucket, ids are not a server filter. */
function showChanges(records: GenerationRecord[]): void {
  const store = useHistoryViewStore.getState()

  store.resetFilters()
  const buckets = new Set(
    records.map((record) => (record.status === 'completed' ? 'done' : 'failed')),
  )

  if (buckets.size === 1) store.setFilters({ status: buckets.values().next().value })

  document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const first = records[0]

  if (records.length > 0) window.setTimeout(() => scrollToRecord(first.id), HISTORY_SCROLL_DELAY_MS)
}

function notifyHidden(title: string, body: string): void {
  if (document.visibilityState !== 'hidden') return

  void getPlatform()
    .then((platform) => platform.notify(title, body))
    .catch(() => {})
}

/** Toasts for status transitions, hidden-tab notifications and the tab title. */
export function useJobNotifications(params: JobNotificationParams): void {
  const { records, activeCount, isLoading } = params
  const previous = useRef<Map<string, JobStatus> | null>(null)
  const baseTitle = useRef<string | null>(null)
  const summaryChecked = useRef(false)

  useEffect(() => {
    baseTitle.current ??= document.title
    const title = baseTitle.current

    return () => {
      if (title !== '') document.title = title
    }
  }, [])

  useEffect(() => {
    document.title =
      activeCount > 0 ? `(${activeCount}) Generating \u00b7 Unplatform AI` : 'Unplatform AI'
  }, [activeCount])

  useEffect(() => {
    if (summaryChecked.current || isLoading) return

    summaryChecked.current = true
    const lastSeen = readLastSeen()

    writeLocal(LAST_SEEN_KEY, new Date().toISOString())

    if (isNil(lastSeen)) return

    const changes = records.filter(
      (record) =>
        SUMMARY_STATUSES.includes(record.status) && Date.parse(record.updatedAt) > lastSeen,
    )

    if (changes.length === 0) return

    toast(summaryText(changes), {
      duration: 10_000,
      action: { label: 'Show', onClick: () => showChanges(changes) },
    })
  }, [isLoading, records])

  useEffect(() => {
    const before = previous.current

    previous.current = new Map(records.map((record) => [record.id, record.status]))

    if (!before) return

    for (const record of records) {
      const previousStatus = before.get(record.id)

      if (isNil(previousStatus) || previousStatus === record.status) continue

      const body = truncate(plainPrompt(record), 80)

      if (record.status === 'completed') {
        toast.success('Video ready', {
          description: body,
          action: { label: 'Show', onClick: () => scrollToRecord(record.id) },
        })
        notifyHidden('Video ready', body)
      }

      const failedTitle = FAILED_TITLES[record.status]

      if (!isNil(failedTitle)) {
        toast.error(failedTitle, { description: record.error ?? body })
      }
    }
  }, [records])
}
