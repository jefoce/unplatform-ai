// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import type { GenerationListResult } from '@/core/api/video'
import { patchPage } from '@/features/history/list/history-pages'
import { currentFavoriteEpoch, markFavoriteChange } from '@/lib/favorite-epoch'

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
      epoch: currentFavoriteEpoch(),
    })

    expect(patched.items[0]?.status).toBe('completed')
    expect(patched.activeCount).toBe(0)
  })

  it('keeps a favorite changed after the poll started', () => {
    const polled = record('one', { favorite: false })
    const local = record('one', { favorite: true })
    const page: GenerationListResult = { items: [local], nextCursor: null, activeCount: 0 }
    const epoch = currentFavoriteEpoch()

    markFavoriteChange('one')

    const patched = patchPage({
      page,
      byId: new Map([['one', polled]]),
      activeCount: 0,
      epoch,
    })

    expect(patched.items[0]?.favorite).toBe(true)
    expect(patched.items[0]?.status).toBe(local.status)
  })

  it('applies a poll started after the favorite change', () => {
    const polled = record('one', { status: 'completed' })
    const page: GenerationListResult = { items: [record('one')], nextCursor: null, activeCount: 1 }

    markFavoriteChange('one')

    const patched = patchPage({
      page,
      byId: new Map([['one', polled]]),
      activeCount: 0,
      epoch: currentFavoriteEpoch(),
    })

    expect(patched.items[0]?.status).toBe('completed')
  })

  it('keeps a local record updated after the poll response was captured', () => {
    const local = { ...record('one'), updatedAt: '2026-01-01T00:00:02.000Z' }

    const polled = {
      ...record('one', { status: 'failed' }),
      updatedAt: '2026-01-01T00:00:01.000Z',
    }

    const page: GenerationListResult = { items: [local], nextCursor: null, activeCount: 1 }

    const patched = patchPage({
      page,
      byId: new Map([['one', polled]]),
      activeCount: 0,
      epoch: currentFavoriteEpoch(),
    })

    expect(patched.items[0]).toBe(local)
  })
})
