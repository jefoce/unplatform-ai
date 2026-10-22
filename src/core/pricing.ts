import { isNil } from 'lodash-es'

import { outputSize } from './output-size'
import type { AspectChoice, ModelPreset, Resolution } from './presets'

export interface PriceContext {
  resolution: Resolution
  aspect: AspectChoice
  audio: boolean
  hasVideoInput: boolean
}

interface PricePerSecParams {
  preset: ModelPreset
  ctx: PriceContext
  skus?: Record<string, number>
}

const rawRate = (params: PricePerSecParams): number | null => {
  const { preset, ctx, skus } = params
  const table = skus ?? preset.pricing.fallback
  const raw =
    table[
      preset.pricing.key({
        resolution: ctx.resolution,
        audio: ctx.audio && preset.audio.supported,
        hasVideoInput: ctx.hasVideoInput,
      })
    ]

  if (isNil(raw) || !Number.isFinite(raw)) return null
  return raw
}

/** Per-second rate in USD, or null when the SKU is missing. */
export function pricePerSec(params: PricePerSecParams): number | null {
  const { preset, ctx } = params
  const raw = rawRate(params)

  if (isNil(raw)) return null

  if (preset.pricing.kind === 'perSecond') {
    return preset.pricing.unit === 'cents' ? raw / 100 : raw
  }

  const aspect = ctx.aspect === 'auto' ? preset.defaultAspectRatio : ctx.aspect
  const size = outputSize({ preset, resolution: ctx.resolution, aspect })

  if (!size) return null

  return ((size.width * size.height * preset.pricing.fps) / 1024) * raw
}

/** Seconds the provider bills, honoring the preset floor. */
export function billableSeconds(preset: ModelPreset, duration: number): number {
  return Math.max(preset.minBillableSec ?? 0, duration)
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
  skus?: Record<string, number>
}

/** Output plus billed reference seconds, or null when the SKU is missing. */
export function estimatePrice(params: EstimatePriceParams): PriceEstimate | null {
  const { preset, ctx, duration, referenceSeconds, skus } = params
  const rate = pricePerSec({ preset, ctx, skus })

  if (isNil(rate)) return null

  const seconds =
    billableSeconds(preset, duration) + referenceSeconds * preset.pricing.referenceVideoFactor

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
