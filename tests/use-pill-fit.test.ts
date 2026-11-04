import { describe, expect, it } from 'vitest'

import { pickPillFit } from '../src/features/history/status/use-pill-fit'

const PILLS = {
  statusWidth: 84,
  cancelWidth: 96,
  cancelIconWidth: 40,
  gap: 8,
} as const

describe('pickPillFit', () => {
  it('shows both labels when the row fits them', () => {
    expect(pickPillFit({ ...PILLS, rowWidth: 200 })).toBe('full')
  })

  it('drops the cancel label before the status label', () => {
    expect(pickPillFit({ ...PILLS, rowWidth: 150 })).toBe('cancel-icon')
  })

  it('keeps both icons when even the status label does not fit', () => {
    expect(pickPillFit({ ...PILLS, rowWidth: 100 })).toBe('icons')
  })
})
