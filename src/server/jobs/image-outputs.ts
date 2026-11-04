/* eslint-disable max-lines -- one module owns output merging, status and cost */
import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil, sum } from 'lodash-es'

import { isOneOf } from '@/core/guards'
import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import {
  IMAGE_OUTPUT_MEDIA_TYPES,
  type ImageCost,
  type ImageOutput,
  type ImageRecord,
  type ImageRecordStatus,
} from '@/core/schemas/image-record'

import { providerStatusOf } from '../providers/provider-error'
import type { ImageResultItem } from '../providers/types'
import { removeImageOutputFile } from '../repos/images'
import { writeImageOutput } from '../services/image-files'
import { type CallOutcome, errorText, seedForImage } from './image-calls'
import { updateImage } from './image-record'

/** Planned id written at submit time, or a fresh one for legacy records. */
function plannedOutputId(record: ImageRecord, index: number): string {
  return record.outputs[index]?.id ?? randomUUID()
}

interface FailedOutputParams {
  id: string
  index: number
  error: string
  errorStatus?: number
}

function failedOutput(params: FailedOutputParams): ImageOutput {
  const { id, index, error, errorStatus } = params

  return { id, index, status: 'failed', error, errorStatus }
}

interface FailedRangeParams {
  record: ImageRecord
  outcome: CallOutcome
  error: string
}

function failedRange(params: FailedRangeParams): ImageOutput[] {
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

interface SaveItemParams {
  record: ImageRecord
  item: ImageResultItem
  index: number
  outputId: string
}

async function saveItem(params: SaveItemParams): Promise<ImageOutput> {
  const { record, item, index, outputId } = params

  if ('error' in item) {
    return failedOutput({ id: outputId, index, error: item.error })
  }

  if (!isOneOf(IMAGE_OUTPUT_MEDIA_TYPES, item.mediaType)) {
    return failedOutput({
      id: outputId,
      index,
      error: `Unsupported image type: ${item.mediaType.slice(0, 40)}`,
    })
  }

  const saved = await writeImageOutput({
    recordId: record.id,
    outputId,
    index,
    bytes: Buffer.from(item.b64, 'base64'),
    mediaType: item.mediaType,
  })

  return { ...saved, seed: seedForImage(record.seedUsed, index) }
}

async function outcomesFor(record: ImageRecord, outcome: CallOutcome): Promise<ImageOutput[]> {
  if (!isNil(outcome.error)) {
    return failedRange({ record, outcome, error: outcome.error })
  }

  const outputs: ImageOutput[] = []

  for (let offset = 0; offset < outcome.count; offset += 1) {
    const item = outcome.items[offset]
    const index = outcome.start + offset
    const outputId = plannedOutputId(record, index)

    if (isNil(item)) {
      outputs.push(failedOutput({ id: outputId, index, error: 'Provider returned fewer images' }))
      continue
    }

    try {
      outputs.push(await saveItem({ record, item, index, outputId }))
    } catch (error) {
      outputs.push(
        failedOutput({
          id: outputId,
          index,
          error: errorText(error),
          errorStatus: providerStatusOf(error),
        }),
      )
    }
  }

  return outputs
}

interface MergeOutputsParams {
  current: ImageOutput[]
  saved: ImageOutput[]
}

function mergeOutputs(params: MergeOutputsParams): ImageOutput[] {
  const { current, saved } = params

  const byIndex = new Map(
    current.map((output) => {
      return [output.index, output]
    }),
  )

  for (const output of saved) {
    byIndex.set(output.index, output)
  }

  return [...byIndex.values()].sort((left, right) => {
    return left.index - right.index
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

function costFor(record: ImageRecord, outcomes: CallOutcome[]): ImageCost {
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

function recordErrorStatus(outcomes: CallOutcome[]): number | undefined {
  const failed = outcomes.find((outcome) => {
    return !isNil(outcome.error)
  })

  return failed?.errorStatus
}

function recordError(outcomes: CallOutcome[]): string | undefined {
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
function warnOverEstimate(record: ImageRecord): void {
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

interface SaveOutcomeParams {
  record: ImageRecord
  outcome: CallOutcome
  resolved: CallOutcome[]
}

interface AdoptParams {
  current: ImageRecord
  written: ImageOutput[]
  resolved: CallOutcome[]
}

/** Merges files into a record whose status changed mid-save. Never drops a paid image. */
function adopt(params: AdoptParams): ImageRecord {
  const { current, written, resolved } = params
  const outputs = mergeOutputs({ current: current.outputs, saved: written })
  const cost = costFor(current, resolved)

  const hasSaved = written.some((output) => {
    return output.status === 'saved'
  })

  if (!hasSaved) {
    return { ...current, outputs, cost }
  }

  return {
    ...current,
    status: imageStatusFor(outputs),
    outputs,
    cost,
    submit: undefined,
    error: recordError(resolved),
    errorStatus: recordErrorStatus(resolved),
  }
}

/** Writes one call's files, then merges its outputs into the record under the lock. */
export async function saveOutcome(params: SaveOutcomeParams): Promise<void> {
  const { record, outcome, resolved } = params
  const written = await outcomesFor(record, outcome)

  const saved = await updateImage(record.id, (current) => {
    if (current.status === 'saving') {
      return {
        ...current,
        outputs: mergeOutputs({ current: current.outputs, saved: written }),
        cost: costFor(current, resolved),
      }
    }

    return adopt({ current, written, resolved })
  })

  if (isNil(saved)) {
    await Promise.all(
      written.map((output) => {
        return removeImageOutputFile(output)
      }),
    )
  }
}

interface FinishImageParams {
  id: string
  resolved: CallOutcome[]
}

/** Marks the saved record terminal once every call resolved. */
export async function finishImage(params: FinishImageParams): Promise<void> {
  const { id, resolved } = params

  const saved = await updateImage(id, (current) => {
    if (current.status !== 'saving') {
      return null
    }

    const status = imageStatusFor(current.outputs)
    let error: string | undefined
    let errorStatus: number | undefined

    if (status !== 'completed') {
      error = recordError(resolved)
      errorStatus = recordErrorStatus(resolved)
    }

    return {
      ...current,
      status,
      error,
      errorStatus,
    }
  })

  if (!isNil(saved)) {
    warnOverEstimate(saved)
  }
}
