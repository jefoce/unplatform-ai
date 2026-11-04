import { isNil } from 'lodash-es'

import type { PricingConfig, SkuCondition, SkuContext, SkuRule } from './types'

interface MatchParams {
  condition: SkuCondition
  ctx: SkuContext
  tier: string
}

/** An unset condition always matches. A set one must equal the context. */
function matchesOptional<T>(expected: T | undefined, actual: T | undefined): boolean {
  if (isNil(expected)) {
    return true
  }

  return expected === actual
}

/** True when every condition the rule sets matches the context. */
export function matchesCondition(params: MatchParams): boolean {
  const { condition, ctx, tier } = params

  return (
    matchesOptional(condition.resolution, ctx.resolution) &&
    matchesOptional(condition.quality, ctx.quality) &&
    matchesOptional(condition.aspect, ctx.aspect) &&
    matchesOptional(condition.audio, ctx.audio) &&
    matchesOptional(condition.hasVideoInput, ctx.hasVideoInput) &&
    matchesOptional(condition.hasTier, tier !== '')
  )
}

function tierOf(pricing: Pick<PricingConfig, 'tiers'>, resolution: string | undefined): string {
  if (isNil(resolution) || isNil(pricing.tiers)) {
    return ''
  }

  return pricing.tiers[resolution] ?? ''
}

interface RuleKeyParams {
  rule: SkuRule
  ctx: SkuContext
  tier: string
}

function ruleKey(params: RuleKeyParams): string {
  const { rule, ctx, tier } = params

  return rule.key
    .replaceAll('{resolution}', ctx.resolution ?? '')
    .replaceAll('{tier}', tier)
    .replaceAll('{quality}', ctx.quality ?? '')
    .replaceAll('{aspect}', ctx.aspect ?? '')
}

/** Key of the first matching rule, or an empty key when none match. */
export function skuKey(
  pricing: Pick<PricingConfig, 'skuRules' | 'tiers'>,
  ctx: SkuContext,
): string {
  const tier = tierOf(pricing, ctx.resolution)

  const rule = pricing.skuRules.find((candidate) => {
    return matchesCondition({ condition: candidate.when, ctx, tier })
  })

  if (isNil(rule)) {
    return ''
  }

  return ruleKey({ rule, ctx, tier })
}
