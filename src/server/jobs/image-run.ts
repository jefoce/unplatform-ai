import 'server-only'

import { isNil } from 'lodash-es'

import { IMAGE_SUBMIT_PARALLEL, MAX_REQUEST_MB, REQUEST_RESERVE_MB } from '@/core/constants'
import { graceDelayMs } from '@/core/submit-state'

import { encodeImages } from '../media/image-data-url'
import { getImage, saveImage } from '../repos/images'
import { getUpload } from '../repos/uploads'
import { secretsReady } from '../secrets'
import { findImagePresetAny } from '../services/model-catalog'
import { createLimiter } from '../sync/limiter'
import { withLock } from '../sync/lock'
import { type CallOutcome, plannedCalls, type PreparedImage, submitCall } from './image-calls'
import { finishImage, saveOutcome } from './image-outputs'
import { recoverFailedSaving } from './image-reconcile'
import { failImage, updateImage } from './image-record'
import { isImageSubmitStopped, setImageSubmitStage } from './image-submit-queue'
import type { SubmitOutcome } from './submit-queue-factory'

const LIMIT_BYTES = MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024

const limiter = createLimiter('imageSubmitCalls', IMAGE_SUBMIT_PARALLEL)

/** Encodes references, then runs every planned call. Partial results are kept. */
export async function runImageSubmit(id: string, signal?: AbortSignal): Promise<SubmitOutcome> {
  await secretsReady()
  const record = await getImage(id)

  if (record?.status !== 'submitting') {
    return 'done'
  }

  if (record.submit?.stage === 'grace' && graceDelayMs(record.submit.notBefore) > 0) {
    return 'requeue'
  }

  try {
    const prepared = await beginSending(id)

    if (!prepared) {
      return 'done'
    }

    await sendAll(prepared, signal)
  } catch (error) {
    await failImage(id, error)
    await recoverFailedSaving(id)
  } finally {
    setImageSubmitStage(id, null)
  }

  return 'done'
}

async function beginSending(id: string): Promise<PreparedImage | null> {
  return withLock(id, async () => {
    const record = await getImage(id)

    if (record?.status !== 'submitting' || record.submit?.stage !== 'grace') {
      return null
    }

    const preset = await findImagePresetAny(record.input.presetId)

    if (!preset) {
      throw new Error('Unknown model')
    }

    const uploads = await Promise.all(
      record.input.references.map((referenceId) => {
        return getUpload(referenceId)
      }),
    )

    if (
      uploads.some((upload) => {
        return isNil(upload)
      })
    ) {
      throw new Error('A reference was removed before submit')
    }

    const present = uploads.filter((upload) => {
      return !isNil(upload)
    })

    const { plan, media } = await encodeImages({
      uploads: present,
      preset,
      budgetBytes: LIMIT_BYTES,
    })

    const references = plan.images.flatMap((image) => {
      const encoded = media[image.id]

      if (!encoded) {
        return []
      }

      return [{ id: image.id, dataUrl: encoded.url }]
    })

    const hasReferences = record.input.references.length > 0
    let saved = record

    if (hasReferences) {
      saved = await saveImage({
        ...record,
        submit: { ...record.submit, stage: 'uploading', progress: 100 },
      })
    }

    return { record: saved, preset, references }
  })
}

async function sendAll(prepared: PreparedImage, signal?: AbortSignal): Promise<void> {
  const { record } = prepared

  throwIfStopped(signal)
  setImageSubmitStage(record.id, 'sending')

  const marked = await updateImage(record.id, (current) => {
    if (current.status !== 'submitting') {
      return null
    }

    const stage = current.submit?.stage

    if (stage !== 'uploading' && stage !== 'grace') {
      return null
    }

    return { ...current, submit: { ...current.submit, stage: 'sending' } }
  })

  if (!marked) {
    const restoreStage = record.submit?.stage === 'uploading' ? 'uploading' : null

    setImageSubmitStage(record.id, restoreStage)

    return
  }

  const writing = await updateImage(record.id, (current) => {
    if (current.status !== 'submitting') {
      return null
    }

    return { ...current, status: 'saving', submit: undefined }
  })

  if (!writing) {
    return
  }

  const resolved = await runCalls(prepared)

  try {
    await finishImage({ id: writing.id, resolved })
  } finally {
    setImageSubmitStage(writing.id, null)
  }
}

/** Persists each call as soon as it resolves, so a crash keeps paid outputs. */
async function runCalls(prepared: PreparedImage): Promise<CallOutcome[]> {
  const calls = plannedCalls(prepared.record, prepared.preset)
  const resolved: CallOutcome[] = []

  await Promise.all(
    calls.map((call) => {
      return limiter.run(async () => {
        const outcome = await submitCall({ prepared, call })

        resolved.push(outcome)

        await saveOutcome({ record: prepared.record, outcome, resolved })
      })
    }),
  )

  return resolved
}

/** Encoding stops when shutdown closes the image queue. Calls are allowed to finish. */
function throwIfStopped(signal?: AbortSignal): void {
  if (signal?.aborted === true || isImageSubmitStopped()) {
    throw new Error('Interrupted while preparing images')
  }
}
