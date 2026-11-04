import { isEmpty, isNil } from 'lodash-es'

import { ImageEstimateSchema } from '@/core/api/image'
import { primaryBinding } from '@/core/presets/common/bindings'
import { findImagePreset } from '@/core/presets/image'
import { imageQuoteContext, imageUnitOf, quoteWithFallback } from '@/core/pricing/quote'
import type { SkuTable } from '@/core/pricing/types'
import type { ImageGenerationInput } from '@/core/schemas/image-record'
import { issueText } from '@/core/validation/common'
import { validateImageInput } from '@/core/validation/image'
import { ValidationError } from '@/server/errors'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { loadLivePricing } from '@/server/pricing/live'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = await readJsonBody(request)
    const parsed = ImageEstimateSchema.safeParse(body)

    if (!parsed.success) {
      return zodError(parsed.error)
    }

    const preset = findImagePreset(parsed.data.presetId)

    if (isNil(preset)) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    const input: ImageGenerationInput = { ...parsed.data, prompt: '', seed: null }
    const promptChars = Math.min(parsed.data.promptChars, preset.promptMaxChars)
    const promptLength = Math.max(1, Math.min(parsed.data.promptChars, preset.promptMaxChars + 1))
    // The estimate carries prompt length, not text, so validate a bounded stand-in.
    const problems = validateImageInput(preset, { ...input, prompt: 'x'.repeat(promptLength) })

    if (!isEmpty(problems)) {
      throw new ValidationError(problems.map(issueText))
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
      ctx: imageQuoteContext(preset, { ...input, promptChars }),
      skus,
    })

    if (isNil(result)) {
      throw new ValidationError(['This model cannot be priced'])
    }

    return jsonResponse({
      perImageUsd: result.perUnit,
      usd: result.total,
      unit: imageUnitOf(binding.pricing),
      isApproximate: result.isApproximate,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
