import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString, isOneOf } from '@/core/guards'
import type { RecordJob } from '@/core/schemas/generation-record'
import {
  IMAGE_OUTPUT_MEDIA_TYPES,
  type ImageOutput,
  type ImageRecord,
} from '@/core/schemas/image-record'

import { providerStatusOf } from '../providers/provider-error'
import type { ImageResultItem, JobRef } from '../providers/types'
import { removeImageOutputFile } from '../repos/images'
import { writeImageOutput } from '../services/image-files'
import { deleteFinishedResult } from './delete-finished-result'
import { type CallOutcome, errorText, seedForImage } from './image-calls'
import {
  costFor,
  failedOutput,
  failedRange,
  imageStatusFor,
  plannedOutputId,
  recordError,
  recordErrorStatus,
  warnOverEstimate,
} from './image-output-helpers'
import { updateImage } from './image-record'

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

function recordJobOf(job: JobRef | undefined): RecordJob | undefined {
  if (isNil(job)) {
    return undefined
  }

  return { id: job.jobId, submittedAt: job.submittedAt }
}

/** Writes one call's files, then merges its outputs into the record under the lock. */
export async function saveOutcome(params: SaveOutcomeParams): Promise<void> {
  const { record, outcome, resolved } = params
  const written = await outcomesFor(record, outcome)

  const saved = await updateImage(record.id, (current) => {
    const job = current.job ?? recordJobOf(outcome.job)
    let merged = current

    if (!isNil(job)) {
      merged = { ...current, job }
    }

    if (merged.status === 'saving') {
      return {
        ...merged,
        outputs: mergeOutputs({ current: merged.outputs, saved: written }),
        cost: costFor(merged, resolved),
      }
    }

    return adopt({ current: merged, written, resolved })
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
    releaseFinishedResult(saved)
  }
}

/** Only a fully written completed or partial record loses its ComfyUI files. */
function releaseFinishedResult(record: ImageRecord): void {
  if (record.status !== 'completed' && record.status !== 'partial') {
    return
  }

  const isWritten = record.outputs.every((output) => {
    return output.status !== 'saved' || isNonEmptyString(output.file)
  })

  if (!isWritten) {
    return
  }

  deleteFinishedResult({ record, kind: 'image' })
}
