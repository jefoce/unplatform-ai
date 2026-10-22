import 'server-only'

import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'

import { isNil } from 'lodash-es'

import {
  FETCH_TIMEOUTS,
  MAX_DOWNLOAD_RETRIES,
  PREVIEW_AT_SEC,
  PREVIEW_WIDTH,
} from '@/core/constants'
import type { GenerationRecord } from '@/core/types'

import { globalState } from '../global-state'
import { extractFrame, probeMedia } from '../media/ffmpeg'
import { fetchVideoContent, type VideoJobResponse } from '../openrouter/client'
import { downloadPaths } from '../paths'
import { getGeneration, saveGeneration } from '../repos/generations'
import { withLock } from './lock'

const MAX_DOWNLOADS = 2

interface DownloadTask {
  record: GenerationRecord
  job: VideoJobResponse
}

interface DownloadQueue {
  pending: Map<string, DownloadTask>
  active: Set<string>
  stopped: boolean
  failures: Map<string, number>
  diskFullAt: Map<string, number>
}

interface DownloadParams {
  id: string
  job: VideoJobResponse
  input: GenerationRecord['input']
}

interface MakePreviewParams {
  id: string
  video: string
  out: string
}

const DISK_FULL = 'Disk is full. Free some space, the download retries every minute.'
const DISK_FULL_RETRY_MS = 60_000

const downloads = globalState<DownloadQueue>('downloadQueue', () => ({
  pending: new Map(),
  active: new Set(),
  stopped: false,
  failures: new Map(),
  diskFullAt: new Map(),
}))

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

/** Marks the record Downloading, then adds it to the bounded queue. */
export async function queueDownload(
  record: GenerationRecord,
  job: VideoJobResponse,
): Promise<void> {
  const fullAt = downloads.diskFullAt.get(record.id)

  if (downloads.stopped || isDownloadQueued(record.id)) return

  if (!isNil(fullAt) && Date.now() - fullAt < DISK_FULL_RETRY_MS) return

  let marked = record

  if (!record.download) {
    marked = await saveGeneration({ ...record, download: { startedAt: new Date().toISOString() } })
  }

  downloads.pending.set(record.id, { record: marked, job })
  drainDownloads()
}

function drainDownloads(): void {
  while (!downloads.stopped && downloads.active.size < MAX_DOWNLOADS) {
    const entry = downloads.pending.entries().next().value

    if (!entry) return

    const [id, task] = entry

    downloads.pending.delete(id)
    downloads.active.add(id)
    void withLock(id, async () => {
      const current = await getGeneration(id)

      if (!current || current.output) return

      await finalize({ ...task.record, favorite: current.favorite }, task.job)
    })
      .catch((error) => console.error(`[unplatform-ai] download failed for ${id}`, error))
      .finally(() => {
        downloads.active.delete(id)
        drainDownloads()
      })
  }
}

async function finalize(record: GenerationRecord, job: VideoJobResponse): Promise<void> {
  const paths = downloadPaths(record.id)

  if (await isExpiredBeforeDownload({ job, video: paths.video })) {
    await saveGeneration({
      ...record,
      download: undefined,
      status: 'expired',
      error: 'OpenRouter copy expired before download',
    })

    return
  }

  try {
    await download({ id: record.id, job, input: record.input })
  } catch (error) {
    await handleDownloadFailure(record, error)

    return
  }

  await completeDownload({ record, video: paths.video, preview: paths.preview })
}

interface ExpiryParams {
  job: VideoJobResponse
  video: string
}

async function isExpiredBeforeDownload(params: ExpiryParams): Promise<boolean> {
  const { job, video } = params

  if (isNil(job.expires_at) || Date.now() <= job.expires_at * 1000) return false

  return !(await exists(video))
}

async function handleDownloadFailure(record: GenerationRecord, error: unknown): Promise<void> {
  if (!isDiskFull(error)) {
    await saveRetry(record, error)

    return
  }

  downloads.failures.delete(record.id)
  downloads.diskFullAt.set(record.id, Date.now())
  await saveGeneration({
    ...record,
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

  downloads.failures.delete(record.id)
  downloads.diskFullAt.delete(record.id)
  const preview = await makePreview({ id: record.id, video, out: previewPath })
  const probe = await probeMedia(video).catch(() => null)
  const bytes = await fs
    .stat(video)
    .then((stat) => stat.size)
    .catch(() => null)
  const output: NonNullable<GenerationRecord['output']> = {
    video: `${record.id}.mp4`,
  }

  if (!isNil(preview)) output.preview = preview

  if (!isNil(probe?.width)) output.width = probe.width

  if (!isNil(probe?.height)) output.height = probe.height

  if (!isNil(probe?.durationSec)) output.durationSec = probe.durationSec

  if (!isNil(bytes)) output.bytes = bytes

  await saveGeneration({
    ...record,
    download: undefined,
    status: 'completed',
    output,
    error: undefined,
  })
}

/** Counts the failure and fails the record after the retry budget. */
async function saveRetry(record: GenerationRecord, error: unknown): Promise<void> {
  const count = (downloads.failures.get(record.id) ?? 0) + 1

  downloads.failures.set(record.id, count)
  const message = error instanceof Error ? error.message : 'Download failed'
  const isFailed = count >= MAX_DOWNLOAD_RETRIES

  if (isFailed) downloads.failures.delete(record.id)

  await saveGeneration({
    ...record,
    download: undefined,
    status: isFailed ? 'failed' : 'in_progress',
    error: `Download failed: ${message}`,
  })
}

async function makePreview(params: MakePreviewParams): Promise<string | undefined> {
  const { id, video, out } = params

  try {
    await extractFrame({
      videoPath: video,
      atSec: PREVIEW_AT_SEC,
      width: PREVIEW_WIDTH,
      outPath: out,
    })

    return `${id}.preview.png`
  } catch (error) {
    console.error(`[unplatform-ai] preview failed for ${id}`, error)

    return undefined
  }
}

async function download(params: DownloadParams): Promise<void> {
  const { id, job, input } = params
  const paths = downloadPaths(id)
  const response = await openContent({ id, job, input })

  if (!response.body) throw new Error('Empty video response')

  await fs.mkdir(path.dirname(paths.part), { recursive: true })

  try {
    const body = response.body as unknown as ReadableStream

    await pipeline(Readable.fromWeb(body), createWriteStream(paths.part), {
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.content),
    })
    await fs.rename(paths.part, paths.video)
  } catch (error) {
    await fs.unlink(paths.part).catch(() => {})

    throw error
  }
}

async function openContent(params: DownloadParams): Promise<Response> {
  const { id, job, input } = params

  try {
    return await fetchVideoContent({ id, index: 0, fallback: input })
  } catch (error) {
    const url = job.urls?.[0]

    if (isNil(url) || url === '') throw error

    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUTS.content) })

    if (!res.ok) throw new Error(`Video download failed (${res.status})`)

    return res
  }
}

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => true,
    () => false,
  )
}

/** ENOSPC is retried after a pause, not only after a restart. */
function isDiskFull(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOSPC'
}
