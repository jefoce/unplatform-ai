import { isFunction, isNil } from 'lodash-es'

import { APP_RULES } from './app'
import { HTTP_RULES } from './http'
import { SEEDANCE_RULES } from './seedance'
import type { ErrorFamily, FriendlyError, HttpRule, Rule } from './types'
import { WAN_RULES } from './wan'

export type { FriendlyError } from './types'

function matches(rule: Rule, raw: string): boolean {
  if (isFunction(rule.match)) return rule.match(raw)

  if (rule.match instanceof RegExp) return rule.match.test(raw)

  return raw.includes(rule.match)
}

function resolve(rule: Rule | HttpRule, raw: string): FriendlyError {
  const title = isFunction(rule.title) ? rule.title(raw) : rule.title
  let hint: string | undefined

  if (!isNil(rule.hint)) hint = isFunction(rule.hint) ? rule.hint(raw) : rule.hint

  return { title, hint, kind: rule.kind, retry: rule.retry ?? false, raw }
}

const FAMILY_RULES: Record<ErrorFamily, readonly Rule[]> = {
  seedance: SEEDANCE_RULES,
  wan: WAN_RULES,
}

interface FriendlyErrorParams {
  raw: string
  family: ErrorFamily | null
  httpCode?: number
}

/**
 * Translates raw provider or app text into one plain title and hint.
 * Family rules run first, then app rules, then HTTP codes. First match wins.
 */
export function friendlyError(params: FriendlyErrorParams): FriendlyError {
  const { raw, family, httpCode } = params
  let familyRules: readonly Rule[] = []

  if (!isNil(family)) familyRules = FAMILY_RULES[family]

  const rule =
    familyRules.find((candidate) => matches(candidate, raw)) ??
    APP_RULES.find((candidate) => matches(candidate, raw))

  if (rule) return resolve(rule, raw)

  const http = isNil(httpCode) ? undefined : HTTP_RULES[httpCode]

  if (http) return resolve(http, raw)

  return { title: 'Generation failed', hint: raw, kind: 'unknown', retry: false, raw }
}
