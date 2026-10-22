import 'server-only'

import { isNil } from 'lodash-es'

import { referenceVideoSeconds } from '@/core/duration-limits'
import { inputForSubmit } from '@/core/normalize-input'
import { getPreset, type ModelPreset } from '@/core/presets'
import { estimatePrice, type PriceContext } from '@/core/pricing'
import { canonicalizePrompt, referenceSlots } from '@/core/prompt-tokens'
import type { GenerationEstimate, GenerationInput, UploadItem } from '@/core/types'
import { type PriceInput, validateInput } from '@/core/validation'

import { getPricing } from '../openrouter/pricing'
import { getRemoteStore } from '../remote/remote-store'
import { getActiveCount } from '../repos/generations'
import { ValidationError } from '../request-guard'
import { loadUploads } from './run-submit'

export interface GenerationDraft {
  preset: ModelPreset
  input: GenerationInput
  uploads: Record<string, UploadItem>
}

/** Validates one draft and loads only its referenced uploads. */
export async function loadDraft(raw: GenerationInput): Promise<GenerationDraft> {
  const preset = getPreset(raw.presetId)
  const base = inputForSubmit(raw)
  const uploads = await loadUploads(base)
  const input = withCanonicalPrompt(base, uploads)
  const validation = validateInput({
    input,
    uploads,
    preset,
    ctx: {
      activeCount: await getActiveCount(),
      remoteConfigured: !isNil(getRemoteStore()),
    },
  })

  if (!validation.ok) throw new ValidationError(validation.errors)

  return { preset, input, uploads }
}

/** Uploads for a price-only draft. No validation, active count, remote or secrets. */
export async function loadPriceDraft(raw: PriceInput): Promise<GenerationDraft> {
  const preset = getPreset(raw.presetId)
  const input = inputForSubmit({ ...raw, prompt: '', seed: null })
  const uploads = await loadUploads(input)

  return { preset, input, uploads }
}

/** Discounted and list totals for a validated draft. */
export async function estimateGeneration(draft: GenerationDraft): Promise<GenerationEstimate> {
  const { preset, input, uploads } = draft
  const pricing = await getPricing(preset)
  const hasVideoInput =
    input.tab === 'references' && input.references.some((id) => uploads[id]?.kind === 'video')
  const ctx: PriceContext = {
    resolution: input.resolution,
    aspect: input.aspectRatio,
    audio: input.audio,
    hasVideoInput,
  }
  const refSeconds = referenceVideoSeconds({ references: input.references, uploads })
  const estimate = estimatePrice({
    preset,
    ctx,
    duration: input.duration,
    referenceSeconds: refSeconds,
    skus: pricing.skus,
  })

  if (isNil(estimate))
    return {
      estimatedUsd: 0,
      listUsd: 0,
      pricePerSec: 0,
      priceSource: 'unknown',
      discount: pricing.discount,
    }

  const list =
    pricing.discount > 0
      ? estimatePrice({
          preset,
          ctx,
          duration: input.duration,
          referenceSeconds: refSeconds,
          skus: pricing.listSkus,
        })
      : null

  return {
    estimatedUsd: estimate.estimatedUsd,
    listUsd: list?.estimatedUsd ?? estimate.estimatedUsd,
    pricePerSec: estimate.pricePerSec,
    priceSource: pricing.source,
    discount: pricing.discount,
  }
}

/** Canonical prompt slots from reference order. */
function withCanonicalPrompt(
  input: GenerationInput,
  uploads: Record<string, UploadItem>,
): GenerationInput {
  const { counts } = referenceSlots(input.references, (id) => uploads[id]?.kind)
  const prompt = canonicalizePrompt(input.prompt, counts)

  if (prompt === input.prompt) return input

  return { ...input, prompt }
}
