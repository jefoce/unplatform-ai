import { isFunction, isNil } from 'lodash-es'

import type { PresetFamily } from '../presets/types'
import { APP_RULES } from './app'
import { SEEDANCE_RULES } from './seedance'
import type { FriendlyError, HttpRule, HttpRuleTable, Rule } from './types'
import { WAN_RULES } from './wan'

function matches(rule: Rule, raw: string): boolean {
  if (isFunction(rule.match)) {
    return rule.match(raw)
  }

  if (rule.match instanceof RegExp) {
    return rule.match.test(raw)
  }

  return raw.includes(rule.match)
}

function resolve(rule: Rule | HttpRule, raw: string): FriendlyError {
  let title: string

  if (isFunction(rule.title)) {
    title = rule.title(raw)
  } else {
    title = rule.title
  }

  let hint: string | undefined

  if (isFunction(rule.hint)) {
    hint = rule.hint(raw)
  } else {
    hint = rule.hint
  }

  return { title, hint, kind: rule.kind, retry: rule.retry ?? false, raw }
}

const FAMILY_RULES: Record<PresetFamily, readonly Rule[]> = {
  seedance: SEEDANCE_RULES,
  wan: WAN_RULES,
}

interface FriendlyErrorParams {
  raw: string
  family: PresetFamily | null
  httpCode?: number
  httpRules: HttpRuleTable | null
}

/**
 * Translates raw provider or app text into one plain title and hint.
 * Family rules run first, then app rules, then HTTP codes. First match wins.
 */
export function friendlyError(params: FriendlyErrorParams): FriendlyError {
  const { raw, family, httpCode, httpRules } = params
  let familyRules: readonly Rule[] = []

  if (!isNil(family)) {
    familyRules = FAMILY_RULES[family]
  }

  const rule =
    familyRules.find((candidate) => {
      return matches(candidate, raw)
    }) ??
    APP_RULES.find((candidate) => {
      return matches(candidate, raw)
    })

  if (rule) {
    return resolve(rule, raw)
  }

  const isHttp = isNil(httpCode) || isNil(httpRules)

  const http = isHttp ? undefined : httpRules[httpCode]

  if (http) {
    return resolve(http, raw)
  }

  return { title: 'Generation failed', hint: raw, kind: 'unknown', retry: false, raw }
}
