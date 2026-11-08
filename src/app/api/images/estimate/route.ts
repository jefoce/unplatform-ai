import { isEmpty, isNil } from 'lodash-es'

import { ImageEstimateSchema } from '@/core/api/image'
import { primaryBinding } from '@/core/presets/common/bindings'
import { isCustomPresetId } from '@/core/presets/custom'
import { imageQuoteContext, imageUnitOf, quoteWithFallback } from '@/core/pricing/quote'
import type { SkuTable } from '@/core/pricing/types'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import { issueText } from '@/core/validation/common'
import { validateImageInput } from '@/core/validation/image'
import { ValidationError } from '@/server/errors'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { resolveRunPricing } from '@/server/pricing/endpoints'
import { type LivePricing, loadLivePricing } from '@/server/pricing/live'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { findImagePresetAny } from '@/server/services/model-catalog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = await readJsonBody(request)
    const parsed = ImageEstimateSchema.safeParse(body)

    if (!parsed.success) {
      return zodError(parsed.error)
    }

    const preset = await findImagePresetAny(parsed.data.presetId)

    if (isNil(preset)) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    const input: ImageGenerationInput = { ...parsed.data, prompt: '', seed: null }
    const promptChars = Math.min(parsed.data.promptChars, preset.promptMaxChars)
    const cappedPrompt = Math.min(parsed.data.promptChars, preset.promptMaxChars + 1)
    let promptLength = cappedPrompt

    if (preset.promptOptional !== true) {
      promptLength = Math.max(1, cappedPrompt)
    }

    // The estimate carries prompt length, not text, so validate a bounded stand-in.
    const problems = validateImageInput(preset, { ...input, prompt: 'x'.repeat(promptLength) })

    if (!isEmpty(problems)) {
      throw new ValidationError(problems.map(issueText))
    }

    const binding = primaryBinding(preset)
    const isCustom = isCustomPresetId(preset.id)
    let live: LivePricing | null = null

    if (!isCustom) {
      live = await loadLivePricing({
        provider: binding.provider,
        kind: 'image',
        modelId: binding.modelId,
        fallback: binding.pricing.fallback,
        presetId: preset.id,
      })
    }

    const pricing = await resolveRunPricing({
      presetId: preset.id,
      pricing: binding.pricing,
      seconds: 1,
    })

    let skus: SkuTable | undefined

    if (live?.source === 'live') {
      skus = live.skus
    }

    const result = quoteWithFallback({
      preset,
      binding: { ...binding, pricing },
      ctx: imageQuoteContext(preset, { ...input, promptChars }),
      skus,
    })

    if (isNil(result)) {
      throw new ValidationError(['This model cannot be priced'])
    }

    return jsonResponse({
      perImageUsd: result.perUnit,
      usd: result.total,
      unit: imageUnitOf(pricing),
      isApproximate: result.isApproximate,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
