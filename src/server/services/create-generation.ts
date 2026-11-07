import 'server-only'

import { randomInt, randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import {
  MAX_ACTIVE_JOBS,
  MAX_REQUEST_MB,
  REQUEST_RESERVE_MB,
  SEED_MAX,
  SUBMIT_GRACE_MS,
} from '@/core/constants'
import type { ReferencePlan } from '@/core/media/media-types'
import type { ProviderBinding } from '@/core/presets/common/binding'
import { activeBinding, primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type {
  GenerationCost,
  GenerationInput,
  GenerationRecord,
  InputSnapshot,
  PriceSource,
} from '@/core/schemas/generation-record'

import { HttpError } from '../errors'
import { startSubmit } from '../jobs/submit-queue'
import { encodeImages } from '../media/image-data-url'
import { getEndpoint } from '../providers/custom/endpoint-source'
import { endpointIdFromPresetId } from '../providers/custom/preset-link'
import { resolveCustomRunPrice } from '../providers/custom/pricing'
import { customRecordSource } from '../providers/custom/record-source'
import { getVideoProvider } from '../providers/registry'
import { getActiveCount, saveGeneration } from '../repos/generations'
import { withLock } from '../sync/lock'
import { estimateGeneration, loadDraft } from './estimate-generation'
import { snapshotItem } from './upload-snapshot'

/** Validates, writes a grace record, then queues upload and submit in the background. */
export async function createGeneration(raw: GenerationInput): Promise<GenerationRecord> {
  const { preset, input, uploads } = await loadDraft(raw)
  const endpointId = endpointIdFromPresetId(preset.id)
  let endpoint: CustomEndpoint | null = null

  if (!isNil(endpointId)) {
    endpoint = await getEndpoint(endpointId)

    if (isNil(endpoint)) {
      throw new HttpError(409, 'Endpoint removed')
    }
  }

  let binding: ProviderBinding
  let price: PriceResult

  if (isNil(endpoint)) {
    binding = activeBinding(preset, (item) => {
      return getVideoProvider(item.provider).isConfigured()
    })

    price = await quoteEstimate({ preset, input, uploads })
  } else {
    binding = primaryBinding(preset)
    price = customPrice({ endpoint, preset, duration: input.duration })
  }

  const encoded = await encodeImages({
    uploads: Object.values(uploads),
    preset,
    budgetBytes: MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024,
  })

  const now = new Date().toISOString()

  const cost: GenerationCost = {
    currency: 'USD',
    pricePerSec: price.pricePerSec,
    priceSource: price.priceSource,
    estimatedUsd: price.estimatedUsd,
    actualUsd: null,
    referenceSeconds: price.referenceSeconds,
    isByok: null,
    billed: null,
  }

  const record: GenerationRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: binding.provider,
    input: { ...input, frames: { ...input.frames }, references: [...input.references] },
    preset: { id: preset.id, title: preset.title, slug: binding.modelId },
    inputsSnapshot: snapshot(uploads, encoded.plan),
    submit: {
      stage: 'grace',
      notBefore: new Date(Date.now() + SUBMIT_GRACE_MS).toISOString(),
    },
    seedUsed: input.seed ?? randomInt(0, SEED_MAX),
    favorite: false,
    cost,
  }

  if (!isNil(endpoint)) {
    record.source = customRecordSource(preset, endpoint)
  }

  const saved = await withLock('active-generations', async () => {
    if ((await getActiveCount()) >= MAX_ACTIVE_JOBS) {
      throw new HttpError(
        429,
        `${MAX_ACTIVE_JOBS} videos already generating. Wait for one to finish.`,
      )
    }

    return saveGeneration(record)
  })

  await startSubmit(saved.id)

  return saved
}

interface PriceResult {
  estimatedUsd: number
  pricePerSec: number
  priceSource: PriceSource
  referenceSeconds: number | undefined
}

interface QuoteParams {
  preset: VideoPreset
  input: GenerationInput
  uploads: UploadsById
}

async function quoteEstimate(params: QuoteParams): Promise<PriceResult> {
  const { preset, input, uploads } = params
  const estimate = await estimateGeneration({ preset, input, uploads })

  if (estimate.priceSource === 'unknown' || isNil(estimate.estimatedUsd)) {
    throw new HttpError(409, 'Price unavailable for this model')
  }

  if (isNil(estimate.pricePerSec)) {
    throw new HttpError(409, 'Price unavailable for this model')
  }

  return {
    estimatedUsd: estimate.estimatedUsd,
    pricePerSec: estimate.pricePerSec,
    priceSource: estimate.priceSource,
    referenceSeconds: estimate.referenceSeconds,
  }
}

interface CustomPriceParams {
  endpoint: CustomEndpoint
  preset: VideoPreset
  duration: number
}

function customPrice(params: CustomPriceParams): PriceResult {
  const { endpoint, preset, duration } = params
  let pricePerSec = 0

  if (endpoint.pricing.mode === 'perSecond') {
    pricePerSec = endpoint.pricing.usd
  }

  return {
    estimatedUsd: resolveCustomRunPrice({ endpoint, preset, duration }),
    pricePerSec,
    priceSource: 'fallback',
    referenceSeconds: undefined,
  }
}

function snapshot(uploads: UploadsById, plan: ReferencePlan): InputSnapshot {
  const sent = new Map(
    plan.images.map((image) => {
      return [image.id, image]
    }),
  )

  return Object.fromEntries(
    Object.values(uploads).map((upload) => {
      const image = sent.get(upload.id)
      const item = snapshotItem(upload)

      if (image) {
        item.sentWidth = image.width
        item.sentHeight = image.height
        item.sentBytes = image.bytes
        item.format = image.format
        item.flattened = image.flattened
      }

      return [upload.id, item] as const
    }),
  )
}
