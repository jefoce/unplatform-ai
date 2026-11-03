import { withQuery } from './query'

export const REMOTE_STATUS_KEY = '/api/remote/status'
export const CREDITS_KEY = '/api/credits'
export const SECRETS_KEY = '/api/settings/secrets'
export const MODELS_KEY = '/api/models'
export const IMAGES_KEY = '/api/images'
export const ACTIVE_IMAGES_KEY = withQuery(IMAGES_KEY, { active: '1' })

const GENERATION_ESTIMATE_URL = '/api/generations/estimate'

export const IMAGE_ESTIMATE_URL = '/api/images/estimate'

export type GenerationEstimateKey = readonly [string, string]
export type ImageEstimateKey = readonly [string, string]

/** SWR key for one price-only estimate body. */
export function generationEstimateKey(json: string): GenerationEstimateKey {
  return [GENERATION_ESTIMATE_URL, json]
}

/** SWR key for one image price-only estimate body. */
export function imageEstimateKey(json: string): ImageEstimateKey {
  return [IMAGE_ESTIMATE_URL, json]
}
