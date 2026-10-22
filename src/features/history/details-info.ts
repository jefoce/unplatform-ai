import { isNil } from 'lodash-es'

import { formatEstimate, formatUsd } from '@/core/pricing'
import { ACTIVE_STATUSES, type GenerationRecord } from '@/core/types'
import { formatClock } from '@/lib/format'

/** Cost text and its estimate or rate note for one record. */
export function costInfo(record: GenerationRecord): { text: string; note: string } {
  if (ACTIVE_STATUSES.includes(record.status)) {
    return { text: formatEstimate(record.cost.estimatedUsd), note: '' }
  }

  if (record.status !== 'completed') return { text: 'Not billed', note: '' }

  if (isNil(record.cost.actualUsd)) {
    return { text: formatEstimate(record.cost.estimatedUsd), note: 'Cost not reported' }
  }

  const note = `${formatEstimate(record.cost.estimatedUsd)} / ${formatUsd(record.cost.pricePerSec)}/s`

  return { text: formatUsd(record.cost.actualUsd), note }
}

/** Wall time createdAt to the final timestamp or the live clock, as m:ss. */
export function totalTime(record: GenerationRecord, now?: number): string {
  const end = now ?? new Date(record.job?.completedAt ?? record.updatedAt).getTime()

  return formatClock((end - new Date(record.createdAt).getTime()) / 1000)
}
