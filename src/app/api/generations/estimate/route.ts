import { z } from 'zod'

import { findPreset } from '@/core/presets'
import { buildPriceInputSchema } from '@/core/validation'
import { errorResponse, jsonError, zodError } from '@/server/http'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { estimateGeneration, loadPriceDraft } from '@/server/services/estimate-generation'

export const dynamic = 'force-dynamic'

const PresetIdSchema = z.object({ presetId: z.string() }).loose()

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = await readJsonBody(request)
    const presetId = PresetIdSchema.safeParse(body)

    if (!presetId.success) {
      return zodError(presetId.error)
    }

    const preset = findPreset(presetId.data.presetId)

    if (!preset) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    const input = buildPriceInputSchema(preset).safeParse(body)

    if (!input.success) {
      return zodError(input.error)
    }

    const draft = await loadPriceDraft(input.data)

    return Response.json(await estimateGeneration(draft))
  } catch (error) {
    return errorResponse(error)
  }
}
