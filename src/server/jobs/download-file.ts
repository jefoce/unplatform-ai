import 'server-only'

import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'

import { isNil } from 'lodash-es'

import {
  CUSTOM_VIDEO_DOWNLOAD_MAX_BYTES,
  FETCH_TIMEOUTS,
  OPENROUTER_VIDEO_MAX_BYTES,
} from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import type { GenerationRecord } from '@/core/schemas/generation-record'

import { commitFile } from '../fs/atomic-file'
import { probeMedia } from '../media/ffmpeg'
import { downloadPaths } from '../paths'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { endpointRemovedError } from '../providers/custom/errors'
import { instanceIdOf } from '../providers/custom/record-instance'
import { getVideoProvider } from '../providers/registry'
import { safeFetchProviderUrl } from '../providers/safe-fetch'
import type { JobSnapshot, VideoProvider } from '../providers/types'

export interface DownloadTask {
  record: GenerationRecord
  job: JobSnapshot
}

const VIDEO_TOO_LARGE_TEXT = 'Video is larger than the limit'

/** A body that reached the disk but cannot be a complete video. */
export class DownloadIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DownloadIntegrityError'
  }
}

/** Cuts the pipeline once the body passes the cap, so it never fills the disk. */
function cappedVideo(maxBytes: number): Transform {
  let total = 0

  return new Transform({
    // eslint-disable-next-line @typescript-eslint/max-params -- Node's transform signature fixes the count
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.byteLength

      if (total > maxBytes) {
        callback(new DownloadIntegrityError(VIDEO_TOO_LARGE_TEXT))

        return
      }

      callback(null, chunk)
    },
  })
}

export async function download(params: DownloadTask): Promise<void> {
  const { record } = params
  const paths = downloadPaths(record.id)
  const response = await openContent(params)

  if (!response.body) {
    throw new Error('Empty video response')
  }

  // Every provider has a cap: custom endpoints 512 MiB, OpenRouter 2 GiB.
  const cap =
    record.provider === 'custom' ? CUSTOM_VIDEO_DOWNLOAD_MAX_BYTES : OPENROUTER_VIDEO_MAX_BYTES

  const declared = response.headers.get('content-length')

  if (!isNil(declared) && Number(declared) > cap) {
    await response.body.cancel()

    throw new DownloadIntegrityError(VIDEO_TOO_LARGE_TEXT)
  }

  await fs.mkdir(path.dirname(paths.part), { recursive: true })

  try {
    const body = response.body as unknown as ReadableStream

    const streams: Array<NodeJS.ReadableStream | NodeJS.WritableStream> = [
      Readable.fromWeb(body),
      cappedVideo(cap),
      createWriteStream(paths.part),
    ]

    await pipeline(streams, { signal: AbortSignal.timeout(FETCH_TIMEOUTS.content) })

    await verifyDownload({ response, file: paths.part })
    await commitFile({ temp: paths.part, target: paths.video })
  } catch (error) {
    await fs.unlink(paths.part).catch(() => {})

    throw error
  }
}

interface VerifyDownloadParams {
  response: Response
  file: string
}

/** Rejects a short body or one the media probe cannot read, before it becomes the video. */
async function verifyDownload(params: VerifyDownloadParams): Promise<void> {
  const { response, file } = params
  const declared = response.headers.get('content-length')
  const stats = await fs.stat(file)

  if (!isNil(declared)) {
    const expected = Number(declared)

    if (!Number.isFinite(expected) || stats.size !== expected) {
      throw new DownloadIntegrityError(
        `Truncated video download (${stats.size} of ${declared} bytes)`,
      )
    }
  }

  const probe = await probeMedia(file).catch((error: unknown) => {
    throw new DownloadIntegrityError(`Video check failed: ${String(error)}`)
  })

  if (isNil(probe.width) || isNil(probe.height)) {
    throw new DownloadIntegrityError('Downloaded file is not a playable video')
  }
}

async function openContent(params: DownloadTask): Promise<Response> {
  const { record, job } = params
  const jobId = record.job?.id
  const submittedAt = record.job?.submittedAt ?? ''
  let provider: VideoProvider | undefined

  try {
    provider = getVideoProvider(instanceIdOf(record))

    if (!isNonEmptyString(jobId)) {
      throw new Error('Missing provider job id')
    }

    return await provider.fetchContent({
      job: { jobId, submittedAt },
      index: 0,
      fallback: record.input,
    })
  } catch (error) {
    return await fallbackContent({ error, job, provider, record })
  }
}

interface FallbackContentParams {
  error: unknown
  job: JobSnapshot
  provider: VideoProvider | undefined
  record: GenerationRecord
}

function isRemovedEndpoint(record: GenerationRecord): boolean {
  return record.provider === 'custom' && isNil(getEndpointSync(instanceIdOf(record)))
}

interface JobUrlParams {
  url: string
  provider: VideoProvider
}

async function fetchJobUrl(params: JobUrlParams): Promise<Response> {
  const { url, provider } = params

  const res = await safeFetchProviderUrl({
    url,
    hosts: provider.contentHosts,
    timeoutMs: FETCH_TIMEOUTS.content,
  })

  if (!res.ok) {
    throw new Error(`Video download failed (${res.status})`)
  }

  return res
}

async function fallbackContent(params: FallbackContentParams): Promise<Response> {
  const { error, job, provider, record } = params
  const url = job.urls?.[0]

  if (isNonEmptyString(url) && !isNil(provider)) {
    return await fetchJobUrl({ url, provider })
  }

  if (isRemovedEndpoint(record)) {
    throw endpointRemovedError()
  }

  throw error
}
