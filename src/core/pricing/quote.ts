import { isNil } from 'lodash-es'

import { planImageCalls } from '../plan-image-calls'
import type { BindingBase, ProviderBinding } from '../presets/common/binding'
import { primaryBinding } from '../presets/common/bindings'
import type { ImageAspectChoice, ImagePreset, ImageQuality } from '../presets/image/types'
import type { AspectChoice, VideoPreset } from '../presets/video/types'
import {
  imageTokenCost,
  perImageCost,
  perRunCost,
  perSecondCost,
  perSecondRate,
  videoTokenCost,
  videoTokenRate,
} from './formulas'
import type { PriceUnit, PricingConfig, Quote, QuoteSource, SkuTable } from './types'

/** Settings that change a video price. */
export interface PriceContext {
  resolution: string
  aspect: AspectChoice
  audio: boolean
  hasVideoInput: boolean
}

export interface VideoQuoteContext extends PriceContext {
  kind: 'video'
  duration: number
  referenceSeconds: number
}

/** The image estimate only needs the settings that change the billed amount. */
export interface ImagePriceInput {
  count: number
  aspectRatio: ImageAspectChoice
  resolution: string | null
  quality: ImageQuality | null
  background: string | null
  references: readonly string[]

  /** Prompt length, not text. Tokens are estimated at four characters each. */
  promptChars: number
}

export interface ImageQuoteContext extends Omit<ImagePriceInput, 'references'> {
  kind: 'image'
  references: number
  calls: number
}

interface VideoQuoteParams {
  preset: VideoPreset
  binding: ProviderBinding
  ctx: VideoQuoteContext
  skus?: SkuTable
}

interface ImageQuoteParams {
  preset: ImagePreset
  binding: BindingBase
  ctx: ImageQuoteContext
  skus?: SkuTable
}

function sourceOf(skus: SkuTable | undefined): QuoteSource {
  if (isNil(skus)) {
    return 'fallback'
  }

  return 'live'
}

function isVideoQuote(params: VideoQuoteParams | ImageQuoteParams): params is VideoQuoteParams {
  return params.ctx.kind === 'video'
}

/** One quote for either kind. The binding decides the provider and the formula. */
export function quote(params: VideoQuoteParams | ImageQuoteParams): Quote | null {
  const table = params.skus ?? params.binding.pricing.fallback
  const source = sourceOf(params.skus)

  if (isVideoQuote(params)) {
    const result = videoCost({
      preset: params.preset,
      pricing: params.binding.pricing,
      ctx: params.ctx,
      table,
    })

    if (isNil(result)) {
      return null
    }

    return { ...result, source }
  }

  const result = imageCost({
    preset: params.preset,
    pricing: params.binding.pricing,
    ctx: params.ctx,
    table,
  })

  if (isNil(result)) {
    return null
  }

  return { ...result, source }
}

function isPriced(result: Quote | null): result is Quote {
  return !isNil(result) && result.total > 0
}

/** Live quote, or the preset fallback when the table cannot price the input. */
export function quoteWithFallback(params: VideoQuoteParams | ImageQuoteParams): Quote | null {
  const live = quote(params)

  if (isPriced(live)) {
    return live
  }

  return quote({ ...params, skus: undefined })
}

interface VideoCostParams {
  preset: VideoPreset
  pricing: PricingConfig
  ctx: VideoQuoteContext
  table: SkuTable
}

function videoCost(params: VideoCostParams) {
  const { pricing } = params

  if (pricing.formula === 'perSecond') {
    return perSecondCost(params)
  }

  if (pricing.formula === 'videoTokens') {
    return videoTokenCost(params)
  }

  if (pricing.formula === 'perRun') {
    return perRunCost({
      table: params.table,
      units: Math.max(pricing.minBillableSec ?? 0, params.ctx.duration),
    })
  }

  return null
}

interface ImageCostParams {
  preset: ImagePreset
  pricing: PricingConfig
  ctx: ImageQuoteContext
  table: SkuTable
}

function imageCost(params: ImageCostParams) {
  const { pricing } = params

  if (pricing.formula === 'perImage') {
    return perImageCost(params)
  }

  if (pricing.formula === 'imageTokens') {
    return imageTokenCost(params)
  }

  if (pricing.formula === 'perRun') {
    return perRunCost({
      table: params.table,
      units: params.ctx.count,
      runs: params.ctx.calls,
    })
  }

  return null
}

/** Context for one image input, with the provider call count. */
export function imageQuoteContext(preset: ImagePreset, input: ImagePriceInput): ImageQuoteContext {
  return {
    kind: 'image',
    count: input.count,
    calls: planImageCalls(input.count, preset).length,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    quality: input.quality,
    background: input.background,
    references: input.references.length,
    promptChars: input.promptChars,
  }
}

interface PricePerSecParams {
  preset: VideoPreset
  ctx: PriceContext
  binding?: ProviderBinding
  skus?: SkuTable
}

/** Per-second rate in USD, or null when the SKU is missing. */
export function pricePerSec(params: PricePerSecParams): number | null {
  const { preset, ctx, skus } = params
  const binding = params.binding ?? primaryBinding(preset)
  const table = skus ?? binding.pricing.fallback
  const base = { preset, pricing: binding.pricing, ctx, table }

  if (binding.pricing.formula === 'perSecond') {
    return perSecondRate(base)
  }

  return videoTokenRate(base)
}

/** Seconds the provider bills, honoring the preset floor. */
export function billableSeconds(preset: VideoPreset, duration: number): number {
  return Math.max(primaryBinding(preset).pricing.minBillableSec ?? 0, duration)
}

export function imageUnitOf(pricing: PricingConfig): PriceUnit {
  if (pricing.formula === 'imageTokens') {
    return 'token'
  }

  return 'image'
}
