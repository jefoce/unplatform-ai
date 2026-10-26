import { describe, expect, it } from 'vitest'

import type { GenerationListResult, HistoryFilters } from '@/core/types'
import { generationPageKey } from '@/lib/api/generations'
import { withQuery } from '@/lib/api/query'

describe('withQuery', () => {
  it('skips nil and empty values', () => {
    const url = withQuery('/api/uploads', { kind: 'image', ids: undefined, q: '', page: 2 })

    expect(url).toBe('/api/uploads?kind=image&page=2')
  })

  it('returns the base when every value is empty', () => {
    expect(withQuery('/api/uploads', { kind: undefined, q: '' })).toBe('/api/uploads')
  })

  it('appends to a base that already carries a query', () => {
    expect(withQuery('/api/thumbs/a?w=160', { v: 3 })).toBe('/api/thumbs/a?w=160&v=3')
  })
})

describe('generationPageKey', () => {
  const filters: HistoryFilters = { q: ' cat ', favorite: true, status: 'done' }

  it('keeps the history key order', () => {
    const key = generationPageKey({ filters, index: 0, previous: null })

    expect(key).toBe('/api/generations?limit=20&q=cat&favorite=1&status=done')
  })

  it('appends the cursor of the previous page', () => {
    const previous: GenerationListResult = { items: [], nextCursor: '2024|id', activeCount: 0 }
    const key = generationPageKey({ filters: {}, index: 1, previous })

    expect(key).toBe('/api/generations?limit=20&cursor=2024%7Cid')
  })

  it('stops after the last page', () => {
    const previous: GenerationListResult = { items: [], nextCursor: null, activeCount: 0 }

    expect(generationPageKey({ filters, index: 1, previous })).toBeNull()
  })
})
