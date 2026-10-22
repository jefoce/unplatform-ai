import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_REQUEST_MB } from '@/core/constants'
import { getPreset } from '@/core/presets'
import {
  asJobStatus,
  graceDelayMs,
  inputIds,
  transportsFor,
  withTransports,
} from '@/core/submit-state'
import type { ResolvedTransport } from '@/core/transport'
import type { GenerationRecord, UploadItem } from '@/core/types'

import { OpenRouterError, stripStatusPrefix } from '../openrouter/client'
import { getRemoteStore } from '../remote/remote-store'
import { getGeneration, saveGeneration } from '../repos/generations'
import { getUpload } from '../repos/uploads'
import { secretsReady } from '../secrets'
import { withLock } from './lock'
import { buildMedia, recordSent, send, uploadUrls } from './submit-media'
import { setSubmitRunner, setSubmitStage } from './submit-queue'
import { throwIfStopped, updateSubmit } from './submit-record'

const LIMIT_BYTES = MAX_REQUEST_MB * 1024 * 1024

interface Prepared {
  record: GenerationRecord
  uploads: Record<string, UploadItem>
  transports: Record<string, ResolvedTransport>
}

/** Uploads url inputs, then submits once. Failures are stored. */
export async function runSubmit(id: string, signal?: AbortSignal): Promise<void> {
  await secretsReady()
  const record = await getGeneration(id)

  if (record?.status !== 'submitting') return

  if (record.submit?.stage === 'grace' && graceDelayMs(record.submit.notBefore) > 0) {
    await import('./submit-queue').then(({ startSubmit }) => startSubmit(id))

    return
  }

  const prepared = await beginUpload(id)

  if (!prepared) return

  setSubmitStage(id, 'uploading')

  try {
    await uploadAndSend(prepared, signal)
  } catch (error) {
    await fail(id, error)
  } finally {
    setSubmitStage(id, null)
  }
}

setSubmitRunner(runSubmit)

async function beginUpload(id: string): Promise<Prepared | null> {
  return withLock(id, async () => {
    const record = await getGeneration(id)

    if (record?.status !== 'submitting' || record.submit?.stage !== 'grace') return null

    const uploads = await loadUploads(record.input)
    const preset = getPreset(record.input.presetId)
    const transports = transportsFor({
      uploads,
      preset,
      remoteConfigured: !isNil(getRemoteStore()),
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

  if (inputIds(record.input).some((id) => isNil(uploads[id]))) {
    throw new Error('Input file was removed before submit')
  }

  const gone = Object.values(uploads).find((upload) => upload.missing === true)

  if (gone) throw new Error(`File missing: ${gone.originalName}`)

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
      if (current.submit?.stage !== 'uploading') return null

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

  if (saved) void import('./poller').then(({ startPoller }) => startPoller())
}

async function complete(
  id: string,
  response: { id: string; status: string },
): Promise<GenerationRecord | null> {
  return updateSubmit(id, (record) => {
    if (record.status !== 'submitting') return null

    return {
      ...record,
      status: asJobStatus(response.status) ?? 'pending',
      job: { id: response.id, submittedAt: new Date().toISOString() },
      submit: undefined,
    }
  })
}

async function fail(id: string, error: unknown): Promise<void> {
  await updateSubmit(id, (record) => {
    if (record.status !== 'submitting' || (!isNil(record.job) && record.job.id !== '')) return null

    return { ...record, status: 'failed', error: submitError(error), submit: undefined }
  })
}

/** Loads only uploads referenced by the normalized input. */
export async function loadUploads(
  input: GenerationRecord['input'],
): Promise<Record<string, UploadItem>> {
  const items = await Promise.all(inputIds(input).map((id) => getUpload(id)))

  return Object.fromEntries(
    items.filter((item): item is UploadItem => !isNil(item)).map((item) => [item.id, item]),
  )
}

/** Formats a stored failure without repeating the HTTP status. */
export function submitError(error: unknown): string {
  if (!(error instanceof OpenRouterError)) {
    return error instanceof Error ? error.message : 'Submit failed'
  }

  const stripped = stripStatusPrefix(error.message, error.status)
  const message = stripped === '' ? `HTTP ${error.status}` : stripped
  const code = error.code
  const isCodeUseful = !isNil(code) && code !== '' && code !== String(error.status)

  return isCodeUseful ? `${code}: ${message}` : message
}
