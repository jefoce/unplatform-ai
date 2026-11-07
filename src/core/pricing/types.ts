import type { Dict } from '../utility-types'

/** Billed unit of one provider price line. */
export const PRICE_UNITS = ['image', 'token'] as const
export type PriceUnit = (typeof PRICE_UNITS)[number]

export const IMAGE_BILLABLE_KINDS = ['output_image', 'input_image', 'input_text'] as const
export type ImageBillableKind = (typeof IMAGE_BILLABLE_KINDS)[number]

/** One live pricing line, verbatim from the provider list. */
export interface ImagePriceLine {
  billable: ImageBillableKind
  unit: PriceUnit
  costUsd: number
  variant: string | null
}

export const ASPECT_BUCKETS = ['square', 'wide', 'tall'] as const
export type AspectBucket = (typeof ASPECT_BUCKETS)[number]

export const PRICING_FORMULAS = [
  'perSecond',
  'videoTokens',
  'perImage',
  'imageTokens',
  'perRun',
] as const

type PricingFormula = (typeof PRICING_FORMULAS)[number]

export const QUOTE_UNITS = ['second', 'image', 'token'] as const

type QuoteUnit = (typeof QUOTE_UNITS)[number]

export const QUOTE_SOURCES = ['live', 'fallback'] as const
export type QuoteSource = (typeof QUOTE_SOURCES)[number]

export type SkuTable = Readonly<Dict<number>>

/** Live and list SKU rates for one preset. */
export interface PricingInfo {
  skus: Dict<number>
  listSkus: Dict<number>
  discount: number
  source: 'live' | 'fallback' | 'mock'
  fetchedAt: string
}

export type ResolutionTiers = Readonly<Partial<Record<string, string>>>

/** Generic conditions every formula and provider adapter share. */
export interface SkuCondition {
  resolution?: string
  quality?: string
  aspect?: AspectBucket
  audio?: boolean
  hasVideoInput?: boolean
  hasTier?: boolean
}

/** First rule whose every set condition matches wins. */
export interface SkuRule {
  when: SkuCondition
  key: string
}

export interface TokenRule {
  when: SkuCondition
  tokens: number
}

/** Token counts are preset facts, never provider data. */
interface TokenConfig {
  output: readonly TokenRule[]
  reference?: number
}

/** One serializable pricing rule per binding. */
export interface PricingConfig {
  formula: PricingFormula
  skuRules: readonly SkuRule[]
  fallback: SkuTable
  tiers?: ResolutionTiers
  fps?: number
  tokens?: TokenConfig
  minBillableSec?: number
  referenceVideoFactor?: number
}

export interface SkuContext {
  resolution?: string
  quality?: string
  aspect?: AspectBucket
  audio?: boolean
  hasVideoInput?: boolean
}

export interface FormulaResult {
  perUnit: number
  total: number
  isApproximate: boolean
  unit: QuoteUnit
}

export interface Quote extends FormulaResult {
  source: QuoteSource
}

/** Price shown before generation and in pickers. */
export interface PriceQuote {
  usd: number
  isApproximate: boolean
  unit: PriceUnit
  perImageUsd: number
}
