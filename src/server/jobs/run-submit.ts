import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_REQUEST_MB } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import { getPreset } from '@/core/presets'
import { INTERRUPT_SENDING_TEXT } from '@/core/provider-errors/app'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadsById } from '@/core/schemas/upload-item'
import { graceDelayMs, inputIds, transportsFor, withTransports } from '@/core/submit-state'
import type { ResolvedTransport } from '@/core/transport'
import type { Dict } from '@/core/utility-types'

import { ProviderError } from '../providers/provider-error'
import type { SubmittedJob } from '../providers/types'
import { getGeneration, saveGeneration } from '../repos/generations'
import { secretsReady } from '../secrets'
import { loadUploads } from '../services/uploads'
import { getObjectStore } from '../storage/registry'
import { withLock } from '../sync/lock'
import { emitJobSent } from './job-events'
import { buildMedia, recordSent, send, uploadUrls } from './submit-media'
import { setSubmitStage, type SubmitOutcome } from './submit-queue'
import { throwIfStopped, updateSubmit } from './submit-record'

const LIMIT_BYTES = MAX_REQUEST_MB * 1024 * 1024

interface Prepared {
  record: GenerationRecord
  uploads: UploadsById
  transports: Dict<ResolvedTransport>
}

/** Uploads url inputs, then submits once. Failures are stored. */
export async function runSubmit(id: string, signal?: AbortSignal): Promise<SubmitOutcome> {
  await secretsReady()
  const record = await getGeneration(id)

  if (record?.status !== 'submitting') {
    return 'done'
  }

  if (record.submit?.stage === 'grace' && graceDelayMs(record.submit.notBefore) > 0) {
    return 'requeue'
  }

  const prepared = await beginUpload(id)

  if (!prepared) {
    return 'done'
  }

  setSubmitStage(id, 'uploading')

  try {
    await uploadAndSend(prepared, signal)
  } catch (error) {
    await fail(id, error)
  } finally {
    setSubmitStage(id, null)
  }

  return 'done'
}

async function beginUpload(id: string): Promise<Prepared | null> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (record?.status !== 'submitting' || record.submit?.stage !== 'grace') {
      return null
    }

    const uploads = await loadUploads(record.input)
    const preset = getPreset(record.input.presetId)

    const transports = transportsFor({
      uploads,
      preset,
      remoteConfigured: !isNil(getObjectStore()),
    })

    const saved = await saveGeneration({
      ...record,
      inputsSnapshot: withTransports(record.inputsSnapshot, transports),
      submit: { stage: 'uploading', progress: 0 },
    })

    return { record: saved, uploads, transports }
  })
}

async function uploadAndSend(params: Prepared, signal?: AbortSignal): Promise<void> {
  const { record, uploads, transports } = params

  throwIfStopped(signal)

  if (
    inputIds(record.input).some((id) => {
      return isNil(uploads[id])
    })
  ) {
    throw new Error('Input file was removed before submit')
  }

  const gone = Object.values(uploads).find((upload) => {
    return upload.missing === true
  })

  if (gone) {
    throw new Error(`File missing: ${gone.originalName}`)
  }

  const preset = getPreset(record.input.presetId)

  await uploadUrls({ id: record.id, uploads, transports, signal })
  throwIfStopped(signal)
  const built = await buildMedia({ uploads, transports, preset })

  await recordSent(record.id, built.plan)

  if (built.encodedBytes > LIMIT_BYTES) {
    const mb = Math.ceil(built.encodedBytes / (1024 * 1024))

    throw new Error(`Inputs too large in total (${mb} MB, max ${MAX_REQUEST_MB} MB)`)
  }

  throwIfStopped(signal)
  // Mark the stage before the save so shutdown waits for the send that follows it.
  setSubmitStage(record.id, 'sending')
  let marked: GenerationRecord | null

  try {
    marked = await updateSubmit(record.id, (current) => {
      if (current.submit?.stage !== 'uploading') {
        return null
      }

      return { ...current, submit: { ...current.submit, stage: 'sending' } }
    })
  } catch (error) {
    setSubmitStage(record.id, 'uploading')

    throw error
  }

  if (!marked) {
    setSubmitStage(record.id, 'uploading')

    return
  }

  const response = await send({ record, preset, uploads, transports, built })
  const saved = await complete(record.id, response)

  if (saved) {
    emitJobSent(record.id)
  }
}

async function complete(id: string, response: SubmittedJob): Promise<GenerationRecord | null> {
  return updateSubmit(id, (record) => {
    if (record.status !== 'submitting') {
      return null
    }

    return {
      ...record,
      status: response.status,
      job: { id: response.jobId, submittedAt: new Date().toISOString() },
      submit: undefined,
    }
  })
}

async function fail(id: string, error: unknown): Promise<void> {
  await updateSubmit(id, (record) => {
    if (record.status !== 'submitting' || isNonEmptyString(record.job?.id)) {
      return null
    }

    return { ...record, status: 'failed', error: failText(record, error), submit: undefined }
  })
}

/** A send that may have reached the provider keeps the job-may-exist warning. */
function failText(record: GenerationRecord, error: unknown): string {
  const isUncertain =
    error instanceof TypeError || (error instanceof ProviderError && error.kind === 'timeout')

  if (record.submit?.stage === 'sending' && isUncertain) {
    return INTERRUPT_SENDING_TEXT
  }

  return submitError(error)
}

/** Formats a stored failure without repeating the HTTP status. */
export function submitError(error: unknown): string {
  if (error instanceof ProviderError) {
    return formatError(error)
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Submit failed'
}

function formatError(error: ProviderError): string {
  const { code } = error
  const message = error.message === '' ? `HTTP ${error.status}` : error.message
  const isCodeUseful = isNonEmptyString(code) && code !== String(error.status)

  if (isCodeUseful) {
    return `${code}: ${message}`
  }

  return message
}
