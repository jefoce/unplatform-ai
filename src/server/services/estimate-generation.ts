import 'server-only'

import { isEmpty, isNil } from 'lodash-es'

import type { UploadsById } from '@/core/api/uploads'
import type { GenerationEstimate } from '@/core/api/video'
import type { CatalogEntry } from '@/core/catalog'
import { referenceVideoSeconds } from '@/core/duration-limits'
import { inputForSubmit } from '@/core/normalize-input'
import type { ProviderBinding } from '@/core/presets/common/binding'
import { activeBinding, primaryBinding } from '@/core/presets/common/bindings'
import type { VideoPreset } from '@/core/presets/video/types'
import { quoteWithFallback, type VideoQuoteContext } from '@/core/pricing/quote'
import type { SkuTable } from '@/core/pricing/types'
import { canonicalizePrompt, referenceSlots } from '@/core/prompt-tokens'
import type { GenerationInput } from '@/core/schemas/generation-record'
import { type PriceInput, validateInput } from '@/core/validation/video'
import { validateAspect } from '@/core/validation/video-rules'

import { ValidationError } from '../errors'
import { resolveRunPricing } from '../pricing/endpoints'
import { type LivePricing, loadLivePricing } from '../pricing/live'
import { endpointIdFromPresetId } from '../providers/custom/preset-link'
import { getVideoProvider } from '../providers/registry'
import { getActiveCount } from '../repos/generations'
import { getObjectStore } from '../storage/registry'
import { findVideoPresetAny, getModelCatalog } from './model-catalog'
import { loadUploads } from './uploads'

export interface GenerationDraft {
  preset: VideoPreset
  input: GenerationInput
  uploads: UploadsById
}

interface EstimateSource {
  binding: ProviderBinding
  live: LivePricing | null
}

/** Validates one draft and loads only its referenced uploads. */
export async function loadDraft(raw: GenerationInput): Promise<GenerationDraft> {
  const preset = await findVideoPresetAny(raw.presetId)

  if (!preset) {
    throw new ValidationError(['Unknown model'])
  }

  const entry = await loadCatalogEntry(preset.id)
  const base = inputForSubmit(raw)
  const uploads = await loadUploads(base)
  const input = withCanonicalPrompt(base, uploads)

  const validation = validateInput({
    input,
    uploads,
    preset,
    ctx: {
      activeCount: await getActiveCount(),
      remoteConfigured: !isNil(getObjectStore()),
      modelStatus: entry?.status ?? 'unverified',
      modelReason: entry?.reason ?? null,
    },
  })

  if (!validation.ok) {
    throw new ValidationError(validation.errors)
  }

  return { preset, input, uploads }
}

/** Uploads for a price-only draft. Only aspect is validated, so the price can show early. */
export async function loadPriceDraft(raw: PriceInput): Promise<GenerationDraft> {
  const preset = await findVideoPresetAny(raw.presetId)

  if (!preset) {
    throw new ValidationError(['Unknown model'])
  }

  await loadCatalogEntry(preset.id)
  const input = inputForSubmit({ ...raw, prompt: '', seed: null })
  const aspect = validateAspect(input, preset)

  if (!isEmpty(aspect.errors)) {
    throw new ValidationError(aspect.errors)
  }

  const uploads = await loadUploads(input)

  return { preset, input, uploads }
}

/** Missing and unconfigured models fail loudly. Unverified ones proceed. */
export async function loadCatalogEntry(presetId: string): Promise<CatalogEntry | undefined> {
  const { entries } = await getModelCatalog()

  const entry = entries.find((item) => {
    return item.presetId === presetId
  })

  if (isNil(entry)) {
    return undefined
  }

  if (entry.status === 'missing' || entry.status === 'no_provider' || entry.status === 'invalid') {
    throw new ValidationError([entry.reason ?? 'Model unavailable'])
  }

  return entry
}

/** Discounted and list totals for a validated draft. */
export async function estimateGeneration(draft: GenerationDraft): Promise<GenerationEstimate> {
  const { preset, input, uploads } = draft

  const { binding, live } = await estimateSource(preset)
  const discountPct = discountOf(live)

  const pricing = await resolveRunPricing({
    presetId: preset.id,
    pricing: binding.pricing,
    seconds: input.duration,
  })

  const resolved = { ...binding, pricing }

  const hasVideoInput =
    input.tab === 'references' &&
    input.references.some((id) => {
      return uploads[id]?.kind === 'video'
    })

  const referenceSeconds = referenceVideoSeconds({ references: input.references, uploads })

  const ctx: VideoQuoteContext = {
    kind: 'video',
    resolution: input.resolution,
    aspect: input.aspectRatio,
    audio: input.audio,
    hasVideoInput,
    duration: input.duration,
    referenceSeconds,
  }

  let skus: SkuTable | undefined

  if (live?.source === 'live') {
    skus = live.skus
  }

  const estimate = quoteWithFallback({ preset, binding: resolved, ctx, skus })

  if (isNil(estimate)) {
    return {
      estimatedUsd: null,
      listUsd: null,
      pricePerSec: null,
      priceSource: 'unknown',
      discount: discountPct,
      referenceSeconds,
    }
  }

  let list = null

  if (discountPct > 0) {
    list = quoteWithFallback({ preset, binding: resolved, ctx, skus: live?.listSkus })
  }

  return {
    estimatedUsd: estimate.total,
    listUsd: list?.total ?? estimate.total,
    pricePerSec: estimate.perUnit,
    priceSource: estimate.source,
    discount: discountPct,
    referenceSeconds,
  }
}

/** Live pricing for the active binding. Custom endpoints never fetch live rates. */
async function estimateSource(preset: VideoPreset): Promise<EstimateSource> {
  if (!isNil(endpointIdFromPresetId(preset.id))) {
    return { binding: primaryBinding(preset), live: null }
  }

  const binding = activeBinding(preset, (item) => {
    return getVideoProvider(item.provider).isConfigured()
  })

  const live = await loadLivePricing({
    provider: binding.provider,
    kind: 'video',
    modelId: binding.modelId,
    fallback: binding.pricing.fallback,
    presetId: preset.id,
  })

  return { binding, live }
}

function discountOf(live: LivePricing | null): number {
  return live?.discountPct ?? 0
}

/** Canonical prompt slots from reference order. */
function withCanonicalPrompt(input: GenerationInput, uploads: UploadsById): GenerationInput {
  const { counts } = referenceSlots(input.references, (id) => {
    return uploads[id]?.kind
  })

  const prompt = canonicalizePrompt(input.prompt, counts)

  if (prompt === input.prompt) {
    return input
  }

  return { ...input, prompt }
}
