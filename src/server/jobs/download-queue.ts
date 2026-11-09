import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_DOWNLOAD_RETRIES, SUBMIT_YIELD_MS } from '@/core/constants'
import { COPY_EXPIRED_TEXT } from '@/core/provider-errors/app'
import type { GenerationRecord } from '@/core/schemas/generation-record'

import { exists, isDiskFull } from '../fs/stat'
import { globalState } from '../global-state'
import { makePreview } from '../media/preview'
import { downloadPaths } from '../paths'
import type { JobSnapshot } from '../providers/types'
import { getGeneration, saveGeneration, updateGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { deleteFinishedResult } from './delete-finished-result'
import { download, DownloadIntegrityError, type DownloadTask } from './download-file'
import { buildOutput } from './download-output'

const MAX_DOWNLOADS = 2

interface DownloadQueue {
  pending: Map<string, DownloadTask>
  active: Set<string>
  stopped: boolean
  failures: Map<string, number>
  diskFullAt: Map<string, number>
}

const DISK_FULL = 'Disk is full. Free some space, the download retries every minute.'
const DISK_FULL_RETRY_MS = 60_000

const downloads = globalState<DownloadQueue>('downloadQueue', () => {
  return {
    pending: new Map(),
    active: new Set(),
    stopped: false,
    failures: new Map(),
    diskFullAt: new Map(),
  }
})

/** True while a download for this generation is queued or running. */
export function isDownloadQueued(id: string): boolean {
  return downloads.active.has(id) || downloads.pending.has(id)
}

/** Queued or running ids, so health counts never double-count a record. */
export function downloadQueueIds(): string[] {
  return [...downloads.active, ...downloads.pending.keys()]
}

/** Stops accepting downloads. Running ones finish. */
export function stopDownloads(): void {
  downloads.stopped = true
}

/** Waits until no download is running, or the timeout expires. */
export async function waitForDownloadsDone(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (downloads.active.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => {
      setTimeout(resolve, SUBMIT_YIELD_MS)
    })
  }

  return downloads.active.size === 0
}

/** Marks the record Downloading, then adds it to the bounded queue. */
export async function queueDownload(record: GenerationRecord, job: JobSnapshot): Promise<void> {
  const fullAt = downloads.diskFullAt.get(record.id)

  if (downloads.stopped || isDownloadQueued(record.id)) {
    return
  }

  if (!isNil(fullAt) && Date.now() - fullAt < DISK_FULL_RETRY_MS) {
    return
  }

  let marked = record

  if (!record.download) {
    const startedAt = new Date().toISOString()

    const updated = await updateGeneration(record.id, (current) => {
      if (!isNil(current.download)) {
        return null
      }

      return { ...current, download: { startedAt } }
    })

    if (isNil(updated)) {
      return
    }

    marked = updated
  }

  downloads.pending.set(record.id, { record: marked, job })
  drainDownloads()
}

function drainDownloads(): void {
  while (!downloads.stopped && downloads.active.size < MAX_DOWNLOADS) {
    const entry = downloads.pending.entries().next().value

    if (!entry) {
      return
    }

    const [id, task] = entry

    downloads.pending.delete(id)
    downloads.active.add(id)

    void (async () => {
      const current = await getGeneration(id)

      if (!current || current.output) {
        return
      }

      await finalize(task.record, task.job)
    })()
      .catch((error) => {
        console.error(`[unplatform-ai] download failed for ${id}`, error)
      })
      .finally(() => {
        downloads.active.delete(id)
        drainDownloads()
      })
  }
}

async function finalize(record: GenerationRecord, job: JobSnapshot): Promise<void> {
  const paths = downloadPaths(record.id)

  try {
    if (await exists(paths.video)) {
      await completeDownload({ record, video: paths.video, preview: paths.preview })

      return
    }

    if (await isExpiredBeforeDownload({ job, video: paths.video })) {
      await saveIfPresent(record.id, {
        download: undefined,
        status: 'expired',
        error: COPY_EXPIRED_TEXT,
      })

      return
    }

    await download({ record, job })
    await completeDownload({ record, video: paths.video, preview: paths.preview })
  } catch (error) {
    if (error instanceof DownloadIntegrityError) {
      await failIntegrity(record, error)

      return
    }

    await handleDownloadFailure(record, error)
  }
}

/** A truncated or unplayable body fails at once, and the retry route can fetch it again. */
async function failIntegrity(record: GenerationRecord, error: Error): Promise<void> {
  downloads.failures.delete(record.id)
  downloads.diskFullAt.delete(record.id)

  await saveFailure(record.id, {
    download: undefined,
    status: 'failed',
    error: `Download failed: ${error.message}`,
    downloadFailed: true,
  })
}

interface ExpiryParams {
  job: JobSnapshot
  video: string
}

async function isExpiredBeforeDownload(params: ExpiryParams): Promise<boolean> {
  const { job, video } = params

  if (isNil(job.expiresAt) || Date.now() <= job.expiresAt) {
    return false
  }

  return !(await exists(video))
}

async function handleDownloadFailure(record: GenerationRecord, error: unknown): Promise<void> {
  if (!isDiskFull(error)) {
    await saveRetry(record, error)

    return
  }

  downloads.failures.delete(record.id)
  downloads.diskFullAt.set(record.id, Date.now())

  await saveFailure(record.id, {
    download: undefined,
    status: 'in_progress',
    error: DISK_FULL,
  })
}

interface CompleteDownloadParams {
  record: GenerationRecord
  video: string
  preview: string
}

async function completeDownload(params: CompleteDownloadParams): Promise<void> {
  const { record, video, preview: previewPath } = params
  let preview: string | undefined

  try {
    preview = await makePreview({ id: record.id, video, out: previewPath })
  } catch {
    // A missing poster does not fail the completed video.
  }

  const output = await buildOutput({ record, video, preview })

  const isSaved = await saveIfPresent(record.id, {
    download: undefined,
    status: 'completed',
    output,
    previewPending: false,
    error: undefined,
    errorStatus: undefined,
    downloadFailed: undefined,
  })

  // Counters clear only after the record is saved, so a failed finalize is still retried.
  downloads.failures.delete(record.id)
  downloads.diskFullAt.delete(record.id)

  if (isSaved) {
    deleteFinishedResult({ record, kind: 'video' })
  }
}

/**
 * Patches the current record under its lock, so a delete or a favorite toggle
 * during the download wins over the snapshot taken before it started.
 */
async function saveIfPresent(id: string, patch: Partial<GenerationRecord>): Promise<boolean> {
  return withLock(id, async () => {
    const current = await getGeneration(id)

    if (!current) {
      return false
    }

    await saveGeneration({ ...current, ...patch })

    return true
  })
}

/** Logs a failure save that stays locked out, so the record id and code are not lost. */
async function saveFailure(id: string, patch: Partial<GenerationRecord>): Promise<void> {
  try {
    await saveIfPresent(id, patch)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code
    const label = code ?? 'unknown'

    console.error(`[unplatform-ai] failure save for ${id} failed (${label})`, error)
  }
}

/** Counts the failure and fails the record after the retry budget. */
async function saveRetry(record: GenerationRecord, error: unknown): Promise<void> {
  const count = (downloads.failures.get(record.id) ?? 0) + 1

  downloads.failures.set(record.id, count)
  const message = error instanceof Error ? error.message : 'Download failed'
  const isFailed = count >= MAX_DOWNLOAD_RETRIES
  const errorText = `Download failed: ${message}`

  if (isFailed) {
    downloads.failures.delete(record.id)

    await saveFailure(record.id, {
      download: undefined,
      error: errorText,
      status: 'failed',
      downloadFailed: true,
    })

    return
  }

  await saveFailure(record.id, { download: undefined, error: errorText, status: 'in_progress' })
}
