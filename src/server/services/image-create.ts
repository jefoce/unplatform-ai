import 'server-only'

import { randomInt, randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'

import { SEED_MAX, SUBMIT_GRACE_MS } from '@/core/constants'
import { planImageCalls } from '@/core/plan-image-calls'
import { primaryBinding } from '@/core/presets/common/bindings'
import type { ImagePreset } from '@/core/presets/image/types'
import { imageQuoteContext, imageUnitOf, quoteWithFallback } from '@/core/pricing/quote'
import type { SkuTable } from '@/core/pricing/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { ImageCost, ImageGenerationInput, ImageRecord } from '@/core/schemas/image-record'
import { PresetSnapshotSchema } from '@/core/schemas/preset-snapshot'
import type { UploadItem } from '@/core/schemas/upload-item'

import { HttpError } from '../errors'
import { startImageSubmit } from '../jobs/image-submit-queue'
import { loadLivePricing } from '../pricing/live'
import { getEndpoint } from '../providers/custom/endpoint-source'
import { endpointIdFromPresetId } from '../providers/custom/preset-link'
import { resolveCustomRunPrice } from '../providers/custom/pricing'
import { customRecordSource } from '../providers/custom/record-source'
import { saveImage } from '../repos/images'
import { getUpload } from '../repos/uploads'
import { uploadsSnapshot } from './upload-snapshot'

interface ImagePriceParams {
  preset: ImagePreset
  input: ImageGenerationInput
}

interface CreateImageParams {
  preset: ImagePreset
  input: ImageGenerationInput
  price: Pick<ImageCost, 'estimatedUsd' | 'priceSource'>
}

async function referenceUploads(input: ImageGenerationInput): Promise<UploadItem[]> {
  const uploads = await Promise.all(
    input.references.map((id) => {
      return getUpload(id)
    }),
  )

  const isMissing = uploads.some((upload) => {
    return isNil(upload)
  })

  if (isMissing) {
    throw new HttpError(400, 'A reference was not found')
  }

  const isNotImage = uploads.some((upload) => {
    return upload?.kind !== 'image'
  })

  if (isNotImage) {
    throw new HttpError(400, 'References must be images')
  }

  return uploads.filter((upload): upload is UploadItem => {
    return !isNil(upload)
  })
}

interface CustomImagePriceParams {
  endpoint: CustomEndpoint
  preset: ImagePreset
  count: number
}

/** A custom image bills one run per provider call, not per output. */
function customImagePrice(params: CustomImagePriceParams): number {
  const { endpoint, preset, count } = params
  const runPrice = resolveCustomRunPrice({ endpoint, preset, duration: 1 })

  return runPrice * planImageCalls(count, preset).length
}

/** Price of one image call, computed before the active cap lock. */
export async function priceImage(
  params: ImagePriceParams,
): Promise<Pick<ImageCost, 'estimatedUsd' | 'priceSource'>> {
  const { preset, input } = params
  const endpoint = await customEndpointOrNull(preset.id)

  if (!isNil(endpoint)) {
    return {
      estimatedUsd: customImagePrice({ endpoint, preset, count: input.count }),
      priceSource: 'fallback',
    }
  }

  const binding = primaryBinding(preset)

  const live = await loadLivePricing({
    provider: binding.provider,
    kind: 'image',
    modelId: binding.modelId,
    fallback: binding.pricing.fallback,
    presetId: preset.id,
  })

  let skus: SkuTable | undefined

  if (live.source === 'live') {
    skus = live.skus
  }

  const result = quoteWithFallback({
    preset,
    binding,
    ctx: imageQuoteContext(preset, { ...input, promptChars: input.prompt.length }),
    skus,
  })

  if (isNil(result)) {
    // A preset without a matching output line cannot be priced.
    throw new HttpError(400, 'This model cannot be priced')
  }

  return { estimatedUsd: result.total, priceSource: result.source }
}

/** `custom.<endpointId>.<modelId>` is the only link from preset to endpoint. */
async function customEndpointOrNull(presetId: string): Promise<CustomEndpoint | null> {
  const endpointId = endpointIdFromPresetId(presetId)

  if (isNil(endpointId)) {
    return null
  }

  const endpoint = await getEndpoint(endpointId)

  if (isNil(endpoint)) {
    throw new HttpError(409, 'Endpoint removed')
  }

  return endpoint
}

function seedUsed(preset: ImagePreset, seed: number | null): number | null {
  if (!preset.seed) {
    return null
  }

  if (!isNil(seed)) {
    return seed
  }

  return randomInt(0, SEED_MAX)
}

/** Writes a grace record, then queues reference encoding and the calls. */
export async function createImage(params: CreateImageParams): Promise<ImageRecord> {
  const { preset, input, price } = params

  const uploads = await referenceUploads(input)
  const endpoint = await customEndpointOrNull(preset.id)

  const binding = primaryBinding(preset)
  const now = new Date().toISOString()
  const isSeedLocked = preset.seed && !isNil(input.seed)
  const keptSeed = isSeedLocked ? input.seed : null

  const cost: ImageCost = {
    currency: 'USD',
    unit: imageUnitOf(binding.pricing),
    ...price,
    actualUsd: null,
    billed: null,
  }

  if (!isNil(endpoint)) {
    cost.estimatedUsd = customImagePrice({ endpoint, preset, count: input.count })
    cost.priceSource = 'fallback'
  }

  const record: ImageRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: binding.provider,
    preset: { id: preset.id, title: preset.title, slug: binding.modelId },
    input: { ...input, references: [...input.references], seed: keptSeed },
    inputsSnapshot: uploadsSnapshot(uploads),
    submit: {
      stage: 'grace',
      notBefore: new Date(Date.now() + SUBMIT_GRACE_MS).toISOString(),
    },
    outputs: Array.from({ length: input.count }, (_, index) => {
      return { id: randomUUID(), index, status: 'pending' as const }
    }),
    seedUsed: seedUsed(preset, input.seed),
    seedLocked: isSeedLocked,
    cost,
  }

  if (!isNil(endpoint)) {
    record.source = customRecordSource(preset, endpoint)

    record.presetSnapshot = PresetSnapshotSchema.parse({
      id: preset.id,
      title: preset.title,
      family: preset.family,
    })
  }

  const saved = await saveImage(record)

  await startImageSubmit(saved.id)

  return saved
}
