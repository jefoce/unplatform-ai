// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import type { GenerationListResult } from '@/core/types'
import { patchPage } from '@/features/history/history-pages'

import { record } from './helpers/history'

describe('patchPage', () => {
  it('replaces the record and takes the polled active count', () => {
    const active = record('one', { status: 'in_progress' })
    const completed = record('one', { status: 'completed' })
    const page: GenerationListResult = { items: [active], nextCursor: null, activeCount: 1 }

    const patched = patchPage({
      page,
      byId: new Map([['one', completed]]),
      activeCount: 0,
    })

    expect(patched.items[0]?.status).toBe('completed')
    expect(patched.activeCount).toBe(0)
  })
})
