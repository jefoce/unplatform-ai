import { DEFAULT_PRESET_ID, findPreset } from '@/core/presets'
import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { getPricing } from '@/server/openrouter/pricing'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const presetId = new URL(request.url).searchParams.get('preset') ?? DEFAULT_PRESET_ID
    const preset = findPreset(presetId)

    if (!preset) return jsonError({ status: 400, error: 'Unknown model' })

    return Response.json(await getPricing(preset))
  } catch (error) {
    return errorResponse(error)
  }
}
