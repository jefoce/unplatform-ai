import { isNil } from 'lodash-es'

import { outputSize } from './output-size'
import { primaryBinding } from './presets/bindings'
import type {
  AspectChoice,
  ModelPreset,
  PricingRule,
  Resolution,
  SkuCondition,
  SkuContext,
} from './presets/types'
import type { Dict } from './utility-types'

export interface PriceContext {
  resolution: Resolution
  aspect: AspectChoice
  audio: boolean
  hasVideoInput: boolean
}

/** First matching rule wins. An unmatched context returns an empty key. */
export function skuKey(pricing: PricingRule, ctx: SkuContext): string {
  const tier = pricing.tiers[ctx.resolution] ?? ''

  const isMatch = (condition: SkuCondition): boolean => {
    if (!isNil(condition.hasVideoInput) && condition.hasVideoInput !== ctx.hasVideoInput) {
      return false
    }

    if (!isNil(condition.audio) && condition.audio !== ctx.audio) {
      return false
    }

    if (!isNil(condition.hasTier) && condition.hasTier !== (tier !== '')) {
      return false
    }

    return true
  }

  const rule = pricing.skuRules.find((item) => {
    return isMatch(item.when)
  })

  if (isNil(rule)) {
    return ''
  }

  return rule.key.replaceAll('{resolution}', ctx.resolution).replaceAll('{tier}', tier)
}

interface PricePerSecParams {
  preset: ModelPreset
  ctx: PriceContext
  skus?: Dict<number>
}

const rawRate = (params: PricePerSecParams): number | null => {
  const { preset, ctx, skus } = params
  const { pricing } = primaryBinding(preset)
  const table = skus ?? pricing.fallback

  const key = skuKey(pricing, {
    resolution: ctx.resolution,
    audio: ctx.audio && preset.audio.supported,
    hasVideoInput: ctx.hasVideoInput,
  })

  const raw = table[key]

  if (isNil(raw) || !Number.isFinite(raw)) {
    return null
  }

  return raw
}

/** Per-second rate in USD, or null when the SKU is missing. */
export function pricePerSec(params: PricePerSecParams): number | null {
  const { preset, ctx } = params
  const { pricing } = primaryBinding(preset)
  const raw = rawRate(params)

  if (isNil(raw)) {
    return null
  }

  if (pricing.kind === 'perSecond') {
    if (pricing.unit === 'cents') {
      return raw / 100
    }

    return raw
  }

  const aspect = ctx.aspect === 'auto' ? preset.defaultAspectRatio : ctx.aspect
  const size = outputSize({ preset, resolution: ctx.resolution, aspect })

  if (!size) {
    return null
  }

  return ((size.width * size.height * pricing.fps) / 1024) * raw
}

/** Seconds the provider bills, honoring the preset floor. */
export function billableSeconds(preset: ModelPreset, duration: number): number {
  return Math.max(primaryBinding(preset).pricing.minBillableSec, duration)
}

function estimateUsd(rate: number, duration: number): number {
  return rate * duration
}

export interface PriceEstimate {
  pricePerSec: number
  estimatedUsd: number
  seconds: number
}

interface EstimatePriceParams {
  preset: ModelPreset
  ctx: PriceContext
  duration: number
  referenceSeconds: number
  skus?: Dict<number>
}

/** Output plus billed reference seconds, or null when the SKU is missing. */
export function estimatePrice(params: EstimatePriceParams): PriceEstimate | null {
  const { preset, ctx, duration, referenceSeconds, skus } = params
  const rate = pricePerSec({ preset, ctx, skus })

  if (isNil(rate)) {
    return null
  }

  const seconds =
    billableSeconds(preset, duration) +
    referenceSeconds * primaryBinding(preset).pricing.referenceVideoFactor

  return { pricePerSec: rate, estimatedUsd: estimateUsd(rate, seconds), seconds }
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatEstimate(value: number): string {
  return `\u2248 ${formatUsd(value)}`
}

export function formatRate(value: number): string {
  const decimals = Math.round(value * 1000) % 10 === 0 ? 2 : 3

  return `$${value.toFixed(decimals)}/s`
}
