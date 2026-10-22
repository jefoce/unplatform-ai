import type { PresetPricing, PricingKeyParams } from './types'

interface PricingOptions {
  referenceVideoFactor?: number
}

/** Fixed per-second USD rate keyed by resolution. */
export const perSecondPricing = (
  fallback: Record<string, number>,
  { referenceVideoFactor = 0 }: PricingOptions = {},
): PresetPricing => ({
  kind: 'perSecond',
  unit: 'usd',
  key: ({ resolution }) => `duration_seconds_${resolution}`,
  fallback,
  referenceVideoFactor,
})

interface VideoTokenPricingParams extends PricingOptions {
  key: (params: PricingKeyParams) => string
  fallback: Record<string, number>
}

/** Video token cost per pixel-second at the provider's frame rate. */
export const videoTokenPricing = (params: VideoTokenPricingParams): PresetPricing => {
  const { key, fallback, referenceVideoFactor = 0 } = params

  return { kind: 'videoTokens', fps: 24, key, fallback, referenceVideoFactor }
}
