import { isFunction, isNil } from 'lodash-es'

import { APP_RULES } from './app'
import type { FriendlyError, HttpRule, HttpRuleTable, Rule } from './types'

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

interface FriendlyErrorParams {
  raw: string
  rules: readonly Rule[]
  httpCode?: number
  httpRules: HttpRuleTable | null
}

/**
 * Translates raw provider or app text into one plain title and hint.
 * Family rules run first, then app rules, then HTTP codes. First match wins.
 */
export function friendlyError(params: FriendlyErrorParams): FriendlyError {
  const { raw, rules, httpCode, httpRules } = params

  const rule =
    rules.find((candidate) => {
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
