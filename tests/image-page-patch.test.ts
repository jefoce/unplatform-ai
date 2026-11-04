import { describe, expect, it } from 'vitest'

import type { ImageListResult } from '@/core/api/image'
import type { ImageOutput, ImageRecord } from '@/core/schemas/image-record'
import { currentFavoriteEpoch, markFavoriteChange } from '@/lib/favorite-epoch'
import { patchImagePages } from '@/lib/image-page-patch'

const CREATED_AT = '2026-01-01T00:00:00.000Z'

function output(id: string, isFavorite: boolean): ImageOutput {
  return {
    id,
    index: 0,
    status: 'saved',
    file: `${id}.png`,
    mediaType: 'image/png',
    width: 1024,
    height: 1024,
    bytes: 1,
    favorite: isFavorite,
    seed: null,
  }
}

function record(id: string, records: ImageOutput[], status: ImageRecord['status']): ImageRecord {
  return {
    id,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status,
    provider: 'openrouter',
    preset: { id: 'seedream-5-0-flash', title: 'Seedream', slug: 'seedream-5-0-flash' },
    input: {
      presetId: 'seedream-5-0-flash',
      prompt: 'a cat',
      count: records.length,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: records,
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

describe('patchImagePages', () => {
  it('patches loaded records by id and keeps every cursor', () => {
    const first = record('first', [output('first-out', false)], 'submitting')
    const second = record('second', [output('second-out', false)], 'submitting')

    const pages: ImageListResult[] = [
      { items: [first], nextCursor: 'page-two', activeCount: 0 },
      { items: [second], nextCursor: 'page-three', activeCount: 0 },
    ]

    const polled: ImageListResult = {
      items: [
        { ...record('first', [output('first-out', false)], 'completed'), updatedAt: 'later' },
        { ...record('second', [output('second-out', false)], 'completed'), updatedAt: 'later' },
      ],
      nextCursor: 'fresh-page-two',
      activeCount: 0,
    }

    const patched = patchImagePages({ pages, polled, epoch: currentFavoriteEpoch() })

    const cursors = patched.map((page) => {
      return page.nextCursor
    })

    const loaded = patched.flatMap((page) => {
      return page.items
    })

    const statuses = loaded.map((item) => {
      return item.status
    })

    expect(cursors).toEqual(['page-two', 'page-three'])
    expect(statuses).toEqual(['completed', 'completed'])
  })

  it('keeps a favorite changed after the poll started', () => {
    const local = record('first', [output('first-out', true)], 'completed')
    const polled = record('first', [output('first-out', false)], 'completed')
    const pages: ImageListResult[] = [{ items: [local], nextCursor: null, activeCount: 0 }]
    const epoch = currentFavoriteEpoch()

    markFavoriteChange('first-out')

    const patched = patchImagePages({
      pages,
      polled: { items: [polled], nextCursor: null, activeCount: 0 },
      epoch,
    })

    const [item] = patched[0]?.items ?? []

    const saved = item?.outputs.find((output) => {
      return output.status === 'saved'
    })

    expect(saved?.status === 'saved' && saved.favorite).toBe(true)
  })

  it('keeps a local record updated after the poll response was captured', () => {
    const local = {
      ...record('first', [output('first-out', true)], 'completed'),
      updatedAt: '2026-01-01T00:00:02.000Z',
    }

    const polled = {
      ...record('first', [output('first-out', false)], 'failed'),
      updatedAt: '2026-01-01T00:00:01.000Z',
    }

    const pages: ImageListResult[] = [{ items: [local], nextCursor: null, activeCount: 0 }]

    const patched = patchImagePages({
      pages,
      polled: { items: [polled], nextCursor: null, activeCount: 0 },
      epoch: currentFavoriteEpoch(),
    })

    expect(patched[0]?.items[0]).toBe(local)
  })
})

describe('patchImagePages counts and no-op merges', () => {
  it('patches the first page activeCount from the poll', () => {
    const first = record('first', [output('first-out', false)], 'submitting')
    const pages: ImageListResult[] = [{ items: [first], nextCursor: null, activeCount: 2 }]

    const polled: ImageListResult = {
      items: [
        { ...record('first', [output('first-out', false)], 'completed'), updatedAt: 'later' },
      ],
      nextCursor: null,
      activeCount: 0,
    }

    const patched = patchImagePages({ pages, polled, epoch: currentFavoriteEpoch() })

    expect(patched[0]?.activeCount).toBe(0)
    expect(patched[0]?.items[0]?.status).toBe('completed')
  })

  it('keeps the page and item identity when the poll changed nothing', () => {
    const first = record('first', [output('first-out', false)], 'completed')
    const pages: ImageListResult[] = [{ items: [first], nextCursor: null, activeCount: 0 }]

    const polled: ImageListResult = {
      items: [record('first', [output('first-out', false)], 'completed')],
      nextCursor: null,
      activeCount: 0,
    }

    const patched = patchImagePages({ pages, polled, epoch: currentFavoriteEpoch() })

    expect(patched[0]).toBe(pages[0])
    expect(patched[0]?.items).toBe(pages[0]?.items)
  })

  it('keeps the item array when only activeCount changed', () => {
    const first = record('first', [output('first-out', false)], 'completed')
    const pages: ImageListResult[] = [{ items: [first], nextCursor: null, activeCount: 1 }]

    const polled: ImageListResult = {
      items: [record('first', [output('first-out', false)], 'completed')],
      nextCursor: null,
      activeCount: 0,
    }

    const patched = patchImagePages({ pages, polled, epoch: currentFavoriteEpoch() })

    expect(patched[0]).not.toBe(pages[0])
    expect(patched[0]?.items).toBe(pages[0]?.items)
    expect(patched[0]?.activeCount).toBe(0)
  })
})
