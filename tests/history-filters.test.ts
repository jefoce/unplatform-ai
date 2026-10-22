import { describe, expect, it } from 'vitest'

import { applyFilters, countActive, paginate, sortRecords } from '@/core/history-filters'
import type { AspectChoice, Resolution } from '@/core/presets'
import type { GenerationRecord, GeneratorTab, JobStatus } from '@/core/types'

interface RecordOptions {
  id: string
  createdAt: string
  status?: JobStatus
  favorite?: boolean
  prompt?: string
  title?: string
  presetId?: string
  tab?: GeneratorTab
  resolution?: Resolution
  aspect?: AspectChoice
  audio?: boolean
  frames?: GenerationRecord['input']['frames']
  references?: string[]
}

function record(options: RecordOptions): GenerationRecord {
  return {
    id: options.id,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    status: options.status ?? 'completed',
    input: inputFor(options),
    preset: { id: 'wan-3.0', title: options.title ?? 'Wan 3.0', slug: 'alibaba/wan-3.0' },
    inputsSnapshot: {},
    seedUsed: null,
    favorite: options.favorite ?? false,
    cost: {
      currency: 'USD',
      pricePerSec: 0.2,
      priceSource: 'fallback',
      estimatedUsd: 1,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}

function inputFor(options: RecordOptions): GenerationRecord['input'] {
  return {
    presetId: options.presetId ?? 'wan-3.0',
    tab: options.tab ?? 'references',
    prompt: options.prompt ?? 'A cat',
    audio: options.audio ?? true,
    duration: 5,
    aspectRatio: options.aspect ?? '16:9',
    resolution: options.resolution ?? '1080p',
    frames: options.frames ?? { start: null, end: null },
    references: options.references ?? [],
    seed: null,
  }
}

function at(minute: number): string {
  return `2026-10-20T00:${String(minute).padStart(2, '0')}:00.000Z`
}

const records = [
  record({ id: 'a', createdAt: at(1), prompt: 'A Red Fox', favorite: true }),
  record({ id: 'b', createdAt: at(2), prompt: 'Blue whale', status: 'pending', title: 'Other' }),
  record({ id: 'c', createdAt: at(3), status: 'failed' }),
  record({ id: 'd', createdAt: at(4), status: 'cancelled' }),
  record({ id: 'e', createdAt: at(5), status: 'expired' }),
  record({ id: 'f', createdAt: at(6), status: 'in_progress' }),
  record({ id: 'g', createdAt: at(7), status: 'submitting' }),
]

describe('applyFilters', () => {
  it('searches prompt and preset title case-insensitively', () => {
    expect(applyFilters(records, { q: 'RED fox' }).map((r) => r.id)).toEqual(['a'])
    expect(applyFilters(records, { q: 'other' }).map((r) => r.id)).toEqual(['b'])
    expect(applyFilters(records, { q: 'zzz' })).toEqual([])
  })

  it('maps done to completed', () => {
    expect(applyFilters(records, { status: 'done' }).map((r) => r.id)).toEqual(['a'])
  })

  it('maps active to active statuses', () => {
    expect(applyFilters(records, { status: 'active' }).map((r) => r.id)).toEqual(['b', 'f', 'g'])
  })

  it('maps failed to failed, cancelled and expired', () => {
    expect(applyFilters(records, { status: 'failed' }).map((r) => r.id)).toEqual(['c', 'd', 'e'])
  })

  it('returns everything for status all', () => {
    expect(applyFilters(records, { status: 'all' })).toHaveLength(records.length)
  })

  it('filters favorites', () => {
    expect(applyFilters(records, { favorite: true }).map((r) => r.id)).toEqual(['a'])
  })

  it('filters by preset id', () => {
    const mixed = [
      record({ id: 'wan', createdAt: at(1) }),
      record({ id: 'prime', createdAt: at(2), presetId: 'wan-3.0-prime' }),
    ]

    expect(applyFilters(mixed, { model: 'wan-3.0-prime' }).map((r) => r.id)).toEqual(['prime'])
    expect(applyFilters(mixed, { model: 'wan-3.0' }).map((r) => r.id)).toEqual(['wan'])
    expect(applyFilters(mixed, { model: 'removed' })).toEqual([])
  })

  it('filters tab, resolution, aspect and audio', () => {
    expect(applyFilters(records, { tab: 'frames' })).toEqual([])
    expect(applyFilters(records, { tab: 'all' })).toHaveLength(records.length)
    expect(applyFilters(records, { resolution: '720p' })).toEqual([])
    expect(applyFilters(records, { aspect: 'auto' })).toEqual([])
    expect(applyFilters(records, { audio: 'off' })).toEqual([])
    expect(applyFilters(records, { audio: 'on' })).toHaveLength(records.length)
    expect(applyFilters(records, { audio: 'any' })).toHaveLength(records.length)
  })

  it('supports mode text, frames and references over tab', () => {
    const modes = [
      record({ id: 'text', createdAt: at(1) }),
      record({
        id: 'frames',
        createdAt: at(2),
        tab: 'references',
        frames: { start: 's', end: null },
      }),
      record({ id: 'refs', createdAt: at(3), tab: 'frames', references: ['r'] }),
    ]

    expect(applyFilters(modes, { mode: 'text' }).map((r) => r.id)).toEqual(['text'])
    expect(applyFilters(modes, { mode: 'frames' }).map((r) => r.id)).toEqual(['frames'])
    expect(applyFilters(modes, { mode: 'references' }).map((r) => r.id)).toEqual(['refs'])
    expect(applyFilters(modes, { mode: 'all', tab: 'frames' }).map((r) => r.id)).toEqual(['refs'])
  })

  it('does not mutate the input array', () => {
    const original = records.map((r) => r.id)

    applyFilters(records, { q: 'red' })
    expect(records.map((r) => r.id)).toEqual(original)
  })
})

describe('sortRecords', () => {
  it('sorts by createdAt descending without mutating the input', () => {
    const shuffled = [records[2], records[0], records[4]]

    expect(sortRecords(shuffled).map((r) => r.id)).toEqual(['e', 'c', 'a'])
    expect(shuffled.map((r) => r.id)).toEqual(['c', 'a', 'e'])
  })
})

describe('paginate', () => {
  const sorted = sortRecords(records)

  it('walks pages with a createdAt cursor', () => {
    const first = paginate({ records: sorted, cursor: null, limit: 2 })

    expect(first.items.map((r) => r.id)).toEqual(['g', 'f'])
    expect(first.nextCursor).toBe(`${at(6)}|f`)

    const second = paginate({ records: sorted, cursor: first.nextCursor, limit: 2 })

    expect(second.items.map((r) => r.id)).toEqual(['e', 'd'])
    expect(second.nextCursor).toBe(`${at(4)}|d`)

    const third = paginate({ records: sorted, cursor: second.nextCursor, limit: 2 })

    expect(third.items.map((r) => r.id)).toEqual(['c', 'b'])
    expect(third.nextCursor).toBe(`${at(2)}|b`)

    const last = paginate({ records: sorted, cursor: third.nextCursor, limit: 2 })

    expect(last.items.map((r) => r.id)).toEqual(['a'])
    expect(last.nextCursor).toBeNull()
  })

  it('breaks cursor ties by id and accepts a plain createdAt cursor', () => {
    const same = sortRecords([
      record({ id: 'x', createdAt: at(5) }),
      record({ id: 'z', createdAt: at(5) }),
      record({ id: 'y', createdAt: at(5) }),
    ])
    const first = paginate({ records: same, cursor: null, limit: 1 })

    expect(first.items.map((r) => r.id)).toEqual(['z'])
    const second = paginate({ records: same, cursor: first.nextCursor, limit: 1 })

    expect(second.items.map((r) => r.id)).toEqual(['y'])
    const third = paginate({ records: same, cursor: second.nextCursor, limit: 1 })

    expect(third.items.map((r) => r.id)).toEqual(['x'])
    expect(paginate({ records: same, cursor: at(5), limit: 10 }).items.map((r) => r.id)).toEqual([
      'z',
      'y',
      'x',
    ])
  })

  it('defaults the limit and clamps it to the maximum', () => {
    const many = sortRecords(
      Array.from({ length: 60 }, (_, i) => record({ id: `r${i}`, createdAt: at(i % 60) })),
    )

    expect(paginate({ records: many, cursor: null, limit: 0 }).items).toHaveLength(20)
    expect(paginate({ records: many, cursor: null, limit: 100 }).items).toHaveLength(50)
  })
})

describe('countActive', () => {
  it('counts submitting, pending and in_progress records', () => {
    expect(countActive(records)).toBe(3)
    expect(countActive([])).toBe(0)
  })
})
