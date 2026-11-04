import { isNil } from 'lodash-es'

import { parseAspect } from '../media/geometry'
import { outputSize } from '../media/output-size'
import type {
  ImageAspectChoice,
  ImageAspectRatio,
  ImagePreset,
  ImageQuality,
  ImageResolution,
} from '../presets/image/types'
import type { AspectChoice, Resolution, VideoPreset } from '../presets/video/types'
import { matchesCondition, skuKey } from './sku'
import type { AspectBucket, FormulaResult, PricingConfig, SkuTable, TokenRule } from './types'

interface VideoFormulaContext {
  resolution: Resolution
  aspect: AspectChoice
  audio: boolean
  hasVideoInput: boolean
}

interface VideoRateParams {
  preset: VideoPreset
  pricing: PricingConfig
  ctx: VideoFormulaContext
  table: SkuTable
}

/** Per-second rate in USD, or null when the SKU is missing. */
export function perSecondRate(params: VideoRateParams): number | null {
  const { preset, pricing, ctx, table } = params

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

/** Token rate per pixel-second at the provider frame rate. */
export function videoTokenRate(params: VideoRateParams): number | null {
  const { preset, pricing, ctx } = params
  const raw = perSecondRate(params)

  if (isNil(raw)) {
    return null
  }

  const aspect = ctx.aspect === 'auto' ? preset.defaultAspectRatio : ctx.aspect
  const size = outputSize({ preset, resolution: ctx.resolution, aspect })

  if (!size || isNil(pricing.fps)) {
    return null
  }

  return ((size.width * size.height * pricing.fps) / 1024) * raw
}

interface VideoCostContext extends VideoFormulaContext {
  duration: number
  referenceSeconds: number
}

interface VideoCostParams {
  preset: VideoPreset
  pricing: PricingConfig
  ctx: VideoCostContext
  table: SkuTable
}

/** Output plus billed reference seconds, or null when the SKU is missing. */
export function perSecondCost(params: VideoCostParams): FormulaResult | null {
  const { pricing, ctx } = params
  const rate = perSecondRate(params)

  if (isNil(rate)) {
    return null
  }

  const seconds =
    Math.max(pricing.minBillableSec ?? 0, ctx.duration) +
    ctx.referenceSeconds * (pricing.referenceVideoFactor ?? 0)

  return { perUnit: rate, total: rate * seconds, isApproximate: false, unit: 'second' }
}

/** Token rate over output plus billed reference seconds. */
export function videoTokenCost(params: VideoCostParams): FormulaResult | null {
  const { pricing, ctx } = params
  const rate = videoTokenRate(params)

  if (isNil(rate)) {
    return null
  }

  const seconds =
    Math.max(pricing.minBillableSec ?? 0, ctx.duration) +
    ctx.referenceSeconds * (pricing.referenceVideoFactor ?? 0)

  return { perUnit: rate, total: rate * seconds, isApproximate: false, unit: 'second' }
}

interface ImageFormulaContext {
  count: number
  calls: number
  aspectRatio: ImageAspectChoice
  resolution: ImageResolution | null
  quality: ImageQuality | null
  references: number
  promptChars: number
}

interface ImageCostParams {
  preset: ImagePreset
  pricing: PricingConfig
  ctx: ImageFormulaContext
  table: SkuTable
}

function aspectOf(ratio: ImageAspectRatio): AspectBucket | null {
  const sides = parseAspect(ratio)

  if (isNil(sides)) {
    return null
  }

  const [width, height] = sides

  if (width === height) {
    return 'square'
  }

  if (width > height) {
    return 'wide'
  }

  return 'tall'
}

/** The ratio a choice bills at, with `auto` resolved to the provider default. */
function resolvedAspectOf(preset: ImagePreset, choice: ImageAspectChoice): ImageAspectRatio {
  if (choice !== 'auto') {
    return choice
  }

  if (preset.defaultAspectRatio !== 'auto') {
    return preset.defaultAspectRatio
  }

  return preset.autoAspectRatio ?? '1:1'
}

interface TokenRuleParams {
  pricing: PricingConfig
  ctx: ImageFormulaContext
  preset: ImagePreset
}

function tokenRuleOf(params: TokenRuleParams) {
  const { pricing, ctx, preset } = params
  const rules = pricing.tokens?.output ?? []
  const aspect = aspectOf(resolvedAspectOf(preset, ctx.aspectRatio))

  const rule = rules.find((candidate) => {
    return matchesCondition({
      condition: candidate.when,
      ctx: {
        resolution: ctx.resolution ?? undefined,
        quality: ctx.quality ?? undefined,
        aspect: aspect ?? undefined,
      },
      tier: '',
    })
  })

  return rule ?? null
}

function outputKeyOf(params: ImageCostParams): string {
  const { pricing, ctx, preset } = params
  const aspect = aspectOf(resolvedAspectOf(preset, ctx.aspectRatio))

  return skuKey(pricing, {
    resolution: ctx.resolution ?? undefined,
    quality: ctx.quality ?? undefined,
    aspect: aspect ?? undefined,
  })
}

function rateOf(table: SkuTable, key: string): number {
  const value = table[key]

  if (isNil(value) || !Number.isFinite(value)) {
    return 0
  }

  return value
}

/** Rate per output image. */
export function perImageCost(params: ImageCostParams): FormulaResult | null {
  const { ctx, table } = params
  const outputKey = outputKeyOf(params)
  const output = table[outputKey]

  if (isNil(output) || !Number.isFinite(output)) {
    return null
  }

  const references = rateOf(table, 'input_image_base_image') * ctx.references * ctx.calls
  const total = output * ctx.count + references

  return {
    perUnit: total / ctx.count,
    total,
    isApproximate: false,
    unit: 'image',
  }
}

/** Output tokens plus reference and prompt tokens, all estimated from preset facts. */
export function imageTokenCost(params: ImageCostParams): FormulaResult | null {
  const { pricing, ctx, table, preset } = params
  const outputKey = outputKeyOf(params)
  const outputRate = table[outputKey]

  if (isNil(outputRate) || !Number.isFinite(outputRate)) {
    return null
  }

  const rule: TokenRule | null = tokenRuleOf({ pricing, ctx, preset })

  if (isNil(rule)) {
    return null
  }

  const referenceTokens = pricing.tokens?.reference ?? 0
  const references = rateOf(table, 'input_image_base_token') * referenceTokens * ctx.references
  const prompt = rateOf(table, 'input_text_base_token') * Math.ceil(ctx.promptChars / 4)

  const total = rule.tokens * outputRate * ctx.count + (references + prompt) * ctx.calls

  return {
    perUnit: total / ctx.count,
    total,
    isApproximate: true,
    unit: 'token',
  }
}
