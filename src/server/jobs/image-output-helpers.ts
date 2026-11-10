import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil, sum } from 'lodash-es'

import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import type {
  ImageCost,
  ImageOutput,
  ImageRecord,
  ImageRecordStatus,
} from '@/core/schemas/image-record'

import type { CallOutcome } from './image-calls'

/** Planned id written at submit time, or a fresh one for legacy records. */
export function plannedOutputId(record: ImageRecord, index: number): string {
  return record.outputs[index]?.id ?? randomUUID()
}

interface FailedOutputParams {
  id: string
  index: number
  error: string
  errorStatus?: number
}

export function failedOutput(params: FailedOutputParams): ImageOutput {
  const { id, index, error, errorStatus } = params

  return { id, index, status: 'failed', error, errorStatus }
}

interface FailedRangeParams {
  record: ImageRecord
  outcome: CallOutcome
  error: string
}

export function failedRange(params: FailedRangeParams): ImageOutput[] {
  const { record, outcome, error } = params

  return Array.from({ length: outcome.count }, (_, offset) => {
    const index = outcome.start + offset

    return failedOutput({
      id: plannedOutputId(record, index),
      index,
      error,
      errorStatus: outcome.errorStatus,
    })
  })
}

export function imageStatusFor(outputs: ImageOutput[]): ImageRecordStatus {
  const saved = outputs.filter((output) => {
    return output.status === 'saved'
  }).length

  if (saved === 0) {
    return 'failed'
  }

  if (saved === outputs.length) {
    return 'completed'
  }

  return 'partial'
}

export function costFor(record: ImageRecord, outcomes: CallOutcome[]): ImageCost {
  const succeeded = outcomes.filter((outcome) => {
    return isNil(outcome.error)
  })

  const isMaybeCharged =
    record.cost.mayHaveBeenCharged === true ||
    outcomes.some((outcome) => {
      return outcome.isUncertain
    })

  const costs = succeeded.map((outcome) => {
    return outcome.costUsd
  })

  // Failed calls cost nothing. A success with no reported cost makes the total unknown.
  const isUnknown = costs.some((costUsd) => {
    return isNil(costUsd)
  })

  let actualUsd: number | null = null

  if (!isUnknown) {
    const reported = costs.filter((costUsd): costUsd is number => {
      return !isNil(costUsd)
    })

    // An uncertain call may have been charged, so a lone reported zero is not the total.
    if (succeeded.length === 0 && isMaybeCharged) {
      actualUsd = null
    } else {
      actualUsd = sum(reported)
    }
  }

  let isBilled: boolean | null = null

  if (!isNil(actualUsd)) {
    isBilled = actualUsd > 0
  }

  return { ...record.cost, actualUsd, billed: isBilled, mayHaveBeenCharged: isMaybeCharged }
}

export function recordErrorStatus(outcomes: CallOutcome[]): number | undefined {
  const failed = outcomes.find((outcome) => {
    return !isNil(outcome.error)
  })

  return failed?.errorStatus
}

export function recordError(outcomes: CallOutcome[]): string | undefined {
  const hasUncertain = outcomes.some((outcome) => {
    return outcome.isUncertain
  })

  if (hasUncertain) {
    return INTERRUPT_SENDING_TEXT
  }

  const failed = outcomes.find((outcome) => {
    return !isNil(outcome.error)
  })

  return failed?.error ?? undefined
}

/** Dev-only nudge when a run bills past 1.5 times its estimate. */
export function warnOverEstimate(record: ImageRecord): void {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  const { estimatedUsd, actualUsd } = record.cost

  if (isNil(actualUsd) || estimatedUsd <= 0 || actualUsd <= estimatedUsd * 1.5) {
    return
  }

  const ratio = actualUsd / estimatedUsd

  console.warn(
    `[pricing] image actual ${ratio.toFixed(1)}x estimate: ${record.preset.id} est ${estimatedUsd} actual ${actualUsd}`,
  )
}
