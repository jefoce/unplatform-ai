import { isFunction, isNil, isString } from 'lodash-es'

import type { Rule } from './types'

type RuleText = string | ((raw: string) => string)

/** Most specific first, so 401 and 403 win over the generic `r2:` fallback. */
export const R2_RULES: readonly Rule[] = [
  {
    match: /^r2:(?:401|403):/,
    title: 'R2 rejected the key.',
    hint: 'Check the R2 access key and secret in Settings.',
    kind: 'account',
  },
  {
    match: /^r2:404:/,
    title: 'R2 bucket not found.',
    hint: 'Check the bucket name in Settings.',
    kind: 'account',
  },
  {
    match: /^r2:network:/,
    title: "Can't reach R2.",
    hint: 'Check your connection.',
    kind: 'app',
  },
  {
    match: /^r2:/,
    title: 'Cloud storage rejected the upload.',
    hint: 'Check the R2 settings.',
    kind: 'app',
  },
]

function matches(rule: Rule, raw: string): boolean {
  if (rule.match instanceof RegExp) {
    return rule.match.test(raw)
  }

  if (isFunction(rule.match)) {
    return rule.match(raw)
  }

  return isString(rule.match) && raw.includes(rule.match)
}

function textOf(value: RuleText, raw: string): string {
  if (isFunction(value)) {
    return value(raw)
  }

  return value
}

/** Plain text for the Settings R2 test, or null when the text is not an R2 code. */
export function r2TestText(raw: string): string | null {
  if (!raw.startsWith('r2:')) {
    return null
  }

  const rule = R2_RULES.find((candidate) => {
    return matches(candidate, raw)
  })

  if (isNil(rule)) {
    return null
  }

  const title = textOf(rule.title, raw)

  if (isNil(rule.hint)) {
    return title
  }

  return `${title} ${textOf(rule.hint, raw)}`
}
