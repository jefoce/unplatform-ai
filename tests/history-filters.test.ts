import { describe, expect, it } from 'vitest'

import { applyFilters, countActive, paginate, sortRecords } from '@/core/history-filters'

import { at, record, records } from './helpers/history-records'
import { required } from './helpers/required'

describe('applyFilters', () => {
  it('searches prompt and preset title case-insensitively', () => {
    expect(
      applyFilters(records, { q: 'RED fox' }).map((r) => {
        return r.id
      }),
    ).toEqual(['a'])

    expect(
      applyFilters(records, { q: 'other' }).map((r) => {
        return r.id
      }),
    ).toEqual(['b'])

    expect(applyFilters(records, { q: 'zzz' })).toEqual([])
  })

  it('maps done to completed', () => {
    expect(
      applyFilters(records, { status: 'done' }).map((r) => {
        return r.id
      }),
    ).toEqual(['a'])
  })

  it('maps active to active statuses', () => {
    expect(
      applyFilters(records, { status: 'active' }).map((r) => {
        return r.id
      }),
    ).toEqual(['b', 'f', 'g'])
  })

  it('maps failed to failed, cancelled and expired', () => {
    expect(
      applyFilters(records, { status: 'failed' }).map((r) => {
        return r.id
      }),
    ).toEqual(['c', 'd', 'e'])
  })

  it('returns everything for status all', () => {
    expect(applyFilters(records, { status: 'all' })).toHaveLength(records.length)
  })

  it('filters favorites', () => {
    expect(
      applyFilters(records, { favorite: true }).map((r) => {
        return r.id
      }),
    ).toEqual(['a'])
  })

  it('filters by preset id', () => {
    const mixed = [
      record({ id: 'wan', createdAt: at(1) }),
      record({ id: 'prime', createdAt: at(2), presetId: 'wan-3.0-prime' }),
    ]

    expect(
      applyFilters(mixed, { model: 'wan-3.0-prime' }).map((r) => {
        return r.id
      }),
    ).toEqual(['prime'])

    expect(
      applyFilters(mixed, { model: 'wan-3.0' }).map((r) => {
        return r.id
      }),
    ).toEqual(['wan'])

    expect(applyFilters(mixed, { model: 'removed' })).toEqual([])
  })
})

describe('applyFilters modes', () => {
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

    expect(
      applyFilters(modes, { mode: 'text' }).map((r) => {
        return r.id
      }),
    ).toEqual(['text'])

    expect(
      applyFilters(modes, { mode: 'frames' }).map((r) => {
        return r.id
      }),
    ).toEqual(['frames'])

    expect(
      applyFilters(modes, { mode: 'references' }).map((r) => {
        return r.id
      }),
    ).toEqual(['refs'])

    expect(
      applyFilters(modes, { mode: 'all', tab: 'frames' }).map((r) => {
        return r.id
      }),
    ).toEqual(['refs'])
  })

  it('does not mutate the input array', () => {
    const original = records.map((r) => {
      return r.id
    })

    applyFilters(records, { q: 'red' })

    expect(
      records.map((r) => {
        return r.id
      }),
    ).toEqual(original)
  })
})

describe('sortRecords', () => {
  it('sorts by createdAt descending without mutating the input', () => {
    const shuffled = [
      required(records[2], 'record 2'),
      required(records[0], 'record 0'),
      required(records[4], 'record 4'),
    ]

    expect(
      sortRecords(shuffled).map((r) => {
        return r.id
      }),
    ).toEqual(['e', 'c', 'a'])

    expect(
      shuffled.map((r) => {
        return r.id
      }),
    ).toEqual(['c', 'a', 'e'])
  })
})

describe('paginate', () => {
  const sorted = sortRecords(records)

  it('walks pages with a createdAt cursor', () => {
    const first = paginate({ records: sorted, cursor: null, limit: 2 })

    expect(
      first.items.map((r) => {
        return r.id
      }),
    ).toEqual(['g', 'f'])

    expect(first.nextCursor).toBe(`${at(6)}|f`)

    const second = paginate({ records: sorted, cursor: first.nextCursor, limit: 2 })

    expect(
      second.items.map((r) => {
        return r.id
      }),
    ).toEqual(['e', 'd'])

    expect(second.nextCursor).toBe(`${at(4)}|d`)

    const third = paginate({ records: sorted, cursor: second.nextCursor, limit: 2 })

    expect(
      third.items.map((r) => {
        return r.id
      }),
    ).toEqual(['c', 'b'])

    expect(third.nextCursor).toBe(`${at(2)}|b`)

    const last = paginate({ records: sorted, cursor: third.nextCursor, limit: 2 })

    expect(
      last.items.map((r) => {
        return r.id
      }),
    ).toEqual(['a'])

    expect(last.nextCursor).toBeNull()
  })

  it('breaks cursor ties by id and accepts a plain createdAt cursor', () => {
    const same = sortRecords([
      record({ id: 'x', createdAt: at(5) }),
      record({ id: 'z', createdAt: at(5) }),
      record({ id: 'y', createdAt: at(5) }),
    ])

    const first = paginate({ records: same, cursor: null, limit: 1 })

    expect(
      first.items.map((r) => {
        return r.id
      }),
    ).toEqual(['z'])

    const second = paginate({ records: same, cursor: first.nextCursor, limit: 1 })

    expect(
      second.items.map((r) => {
        return r.id
      }),
    ).toEqual(['y'])

    const third = paginate({ records: same, cursor: second.nextCursor, limit: 1 })

    expect(
      third.items.map((r) => {
        return r.id
      }),
    ).toEqual(['x'])

    expect(
      paginate({ records: same, cursor: at(5), limit: 10 }).items.map((r) => {
        return r.id
      }),
    ).toEqual(['z', 'y', 'x'])
  })

  it('defaults the limit and clamps it to the maximum', () => {
    const many = sortRecords(
      Array.from({ length: 60 }, (_, i) => {
        return record({ id: `r${i}`, createdAt: at(i % 60) })
      }),
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
