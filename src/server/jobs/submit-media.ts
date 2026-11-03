import 'server-only'

import { chunk, isNil, sumBy } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import { MAX_REQUEST_MB, REQUEST_RESERVE_MB } from '@/core/constants'
import type { ReferencePlan } from '@/core/media/media-types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { base64Only } from '@/core/submit-state'
import type { ResolvedTransport } from '@/core/transport'
import type { Dict } from '@/core/utility-types'

import { encodeImages } from '../media/image-data-url'
import { toDataUrl } from '../media/to-data-url'
import { getVideoProvider } from '../providers/registry'
import type { ResolvedMedia, SubmittedJob } from '../providers/types'
import { ensureRemote, presignFor } from '../services/remote-inputs'
import { throwIfStopped, updateSubmit } from './submit-record'
import { shouldRetryAsBase64 } from './submit-retry'

const LIMIT_BYTES = MAX_REQUEST_MB * 1024 * 1024
const IMAGE_BUDGET = LIMIT_BYTES - REQUEST_RESERVE_MB * 1024 * 1024

type Transports = Dict<ResolvedTransport>

/** Media built for one submit request. */
export interface BuiltMedia {
  media: Dict<ResolvedMedia>
  encodedBytes: number
  plan: ReferencePlan
}

interface UploadUrlsParams {
  id: string
  uploads: UploadsById
  transports: Transports
  signal?: AbortSignal
}

interface BuildMediaParams {
  uploads: UploadsById
  transports: Transports
  preset: VideoPreset
}

interface SendParams {
  record: GenerationRecord
  preset: VideoPreset
  uploads: UploadsById
  transports: Transports
  built: BuiltMedia
}

/** Uploads url inputs two at a time with combined byte progress. */
export async function uploadUrls(params: UploadUrlsParams): Promise<void> {
  const { id, uploads, transports, signal } = params

  const targets = Object.values(uploads).filter((upload) => {
    return transports[upload.id] === 'url'
  })

  if (targets.length === 0) {
    return
  }

  const total = sumBy(targets, 'sizeBytes')
  const sentBy = new Map<string, number>()
  let lastWrite = 0

  const report = (shouldForce = false): void => {
    const now = Date.now()

    if (!shouldForce && now - lastWrite < 1000) {
      return
    }

    lastWrite = now

    const sent = sumBy(targets, (upload) => {
      return Math.min(sentBy.get(upload.id) ?? 0, upload.sizeBytes)
    })

    let progress = 99

    if (total !== 0) {
      progress = Math.min(99, Math.round((sent / total) * 100))
    }

    void saveProgress(id, progress).catch((error) => {
      console.error(`[unplatform-ai] submit progress failed for ${id}`, error)
    })
  }

  for (const group of chunk(targets, 2)) {
    throwIfStopped(signal)

    await Promise.all(
      group.map(async (upload) => {
        const saved = await ensureRemote({
          upload,
          signal,
          onProgress: (sent, fileTotal) => {
            sentBy.set(upload.id, Math.min(sent, fileTotal))
            report()
          },
        })

        uploads[saved.id] = saved
        sentBy.set(upload.id, upload.sizeBytes)
        report()
      }),
    )
  }

  report(true)
}

export async function buildMedia(params: BuildMediaParams): Promise<BuiltMedia> {
  const { uploads, transports, preset } = params
  const items = Object.values(uploads)

  const remote = await Promise.all(
    items
      .filter((upload) => {
        return transports[upload.id] === 'url'
      })
      .map(async (upload) => {
        return {
          id: upload.id,
          kind: upload.kind,
          url: await presignFor(upload),
          bytes: 0,
        }
      }),
  )

  const inline = items.filter((upload) => {
    return transports[upload.id] !== 'url'
  })

  const others = await Promise.all(
    inline
      .filter((upload) => {
        return upload.kind !== 'image'
      })
      .map(async (upload) => {
        const { url, bytes } = await toDataUrl(upload)

        return { id: upload.id, kind: upload.kind, url, bytes }
      }),
  )

  const { plan, media: images } = await encodeImages({
    uploads: inline.filter((upload) => {
      return upload.kind === 'image'
    }),
    preset,
    budgetBytes: IMAGE_BUDGET,
    baseBytes: sumBy(others, 'bytes'),
  })

  const encoded = Object.entries(images).map(([id, image]) => {
    return {
      id,
      kind: 'image' as const,
      url: image.url,
      bytes: image.bytes,
    }
  })

  const entries = [...remote, ...others, ...encoded]

  const media = Object.fromEntries(
    entries.map(({ id, kind, url }) => {
      return [id, { id, kind, url }]
    }),
  )

  return { media, encodedBytes: sumBy(entries, 'bytes'), plan }
}

/** Stores the encoding actually sent for each image. */
export async function recordSent(id: string, plan: ReferencePlan): Promise<void> {
  if (plan.images.length === 0) {
    return
  }

  const sent = new Map(
    plan.images.map((image) => {
      return [image.id, image]
    }),
  )

  await updateSubmit(id, (record) => {
    return {
      ...record,
      inputsSnapshot: Object.fromEntries(
        Object.entries(record.inputsSnapshot).map(([key, item]) => {
          const image = sent.get(key)

          if (!image) {
            return [key, item]
          }

          return [
            key,
            {
              ...item,
              sentWidth: image.width,
              sentHeight: image.height,
              sentBytes: image.bytes,
              format: image.format,
              flattened: image.flattened,
            },
          ]
        }),
      ),
    }
  })
}

export async function send(params: SendParams): Promise<SubmittedJob> {
  const { record, preset, uploads, transports, built } = params
  const provider = getVideoProvider(record.provider)

  try {
    return await provider.submit({ input: record.input, preset, media: built.media })
  } catch (error) {
    const hasUrlInputs = Object.values(transports).includes('url')

    if (!shouldRetryAsBase64({ error, hasUrlInputs, fitsBase64: true })) {
      throw error
    }

    const retry = await buildMedia({ uploads, transports: base64Only(transports), preset }).catch(
      () => {
        return null
      },
    )

    const canFitBase64 = !isNil(retry) && retry.encodedBytes <= LIMIT_BYTES

    if (!retry || !shouldRetryAsBase64({ error, hasUrlInputs, fitsBase64: canFitBase64 })) {
      throw error
    }

    await markBase64(record.id)
    console.warn(`[unplatform-ai] retrying submit as base64 for ${record.id}`)

    return provider.submit({ input: record.input, preset, media: retry.media })
  }
}

async function saveProgress(id: string, progress: number): Promise<void> {
  await updateSubmit(id, (record) => {
    if (record.submit?.stage !== 'uploading') {
      return null
    }

    return { ...record, submit: { ...record.submit, progress } }
  })
}

async function markBase64(id: string): Promise<void> {
  await updateSubmit(id, (record) => {
    const transport = { transport: 'base64' as const }

    const inputsSnapshot = Object.fromEntries(
      Object.entries(record.inputsSnapshot).map(([key, item]) => {
        return [key, { ...item, ...transport }]
      }),
    )

    return { ...record, inputsSnapshot }
  })
}
