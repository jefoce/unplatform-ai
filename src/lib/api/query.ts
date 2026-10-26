import { isNil } from 'lodash-es'

import type { Dict } from '@/core/utility-types'

type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Dict<QueryValue>

/**
 * Adds only defined, non-empty values to a URL.
 * Appends with `&` when the base already carries a query.
 */
export function withQuery(base: string, params: QueryParams): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (isNil(value) || value === '') {
      continue
    }

    query.set(key, String(value))
  }

  const qs = query.toString()

  if (qs === '') {
    return base
  }

  const hasQuery = base.includes('?')
  const glue = hasQuery ? '&' : '?'

  return `${base}${glue}${qs}`
}
