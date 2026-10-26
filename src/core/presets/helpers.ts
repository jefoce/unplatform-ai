import type {
  PerSecondPricing,
  ResolutionTiers,
  SkuRule,
  SkuTable,
  VideoTokenPricing,
} from './types'

interface PricingOptions {
  referenceVideoFactor?: number
}

/** Fixed per-second USD rate keyed by resolution. */
export const perSecondPricing = (
  fallback: SkuTable,
  { referenceVideoFactor = 0 }: PricingOptions = {},
): PerSecondPricing => {
  return {
    kind: 'perSecond',
    unit: 'usd',
    skuRules: [{ when: {}, key: 'duration_seconds_{resolution}' }],
    tiers: {},
    fallback,
    // Wan bills a 5 second floor regardless of the requested duration.
    minBillableSec: 5,
    referenceVideoFactor,
  }
}

interface VideoTokenPricingParams extends PricingOptions {
  skuRules: readonly SkuRule[]
  tiers?: ResolutionTiers
  fallback: SkuTable
  minBillableSec?: number
}

/** Video token cost per pixel-second at the provider's frame rate. */
export const videoTokenPricing = (params: VideoTokenPricingParams): VideoTokenPricing => {
  const { skuRules, tiers = {}, fallback, minBillableSec = 0, referenceVideoFactor = 0 } = params

  return {
    kind: 'videoTokens',
    fps: 24,
    skuRules,
    tiers,
    fallback,
    minBillableSec,
    referenceVideoFactor,
  }
}
