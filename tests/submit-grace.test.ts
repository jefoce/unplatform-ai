import { describe, expect, it } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { canCancelInGrace, graceDelayMs } from '@/core/submit-state'

type CancelState = Pick<GenerationRecord, 'status' | 'submit' | 'job'>

const state = (overrides: Partial<CancelState> = {}): CancelState => {
  return {
    status: 'submitting',
    submit: { stage: 'grace', notBefore: '2026-01-01T00:00:10.000Z' },
    ...overrides,
  }
}

const NOW = Date.parse('2026-01-01T00:00:00.000Z')

describe('graceDelayMs', () => {
  it('returns the remaining time until notBefore', () => {
    expect(graceDelayMs('2026-01-01T00:00:10.000Z', NOW)).toBe(10_000)
    expect(graceDelayMs('2026-01-01T00:00:02.500Z', NOW)).toBe(2_500)
  })

  it('returns zero once notBefore has passed', () => {
    expect(graceDelayMs('2026-01-01T00:00:00.000Z', NOW)).toBe(0)
    expect(graceDelayMs('2025-12-31T23:59:59.000Z', NOW)).toBe(0)
  })

  it('returns zero for a missing or invalid notBefore', () => {
    expect(graceDelayMs(undefined, NOW)).toBe(0)
    expect(graceDelayMs('not-a-date', NOW)).toBe(0)
  })
})

describe('canCancelInGrace', () => {
  it('allows cancel during grace without a job id', () => {
    expect(canCancelInGrace(state())).toBe(true)
  })

  it('rejects cancel after grace starts uploading or sending', () => {
    expect(canCancelInGrace(state({ submit: { stage: 'uploading' } }))).toBe(false)
    expect(canCancelInGrace(state({ submit: { stage: 'sending' } }))).toBe(false)
  })

  it('rejects cancel once a job id exists', () => {
    expect(
      canCancelInGrace(state({ job: { id: 'job-1', submittedAt: '2026-01-01T00:00:00.000Z' } })),
    ).toBe(false)
  })

  it('rejects cancel when the record is no longer submitting or has no submit state', () => {
    expect(canCancelInGrace(state({ status: 'pending' }))).toBe(false)
    expect(canCancelInGrace(state({ status: 'completed' }))).toBe(false)
    expect(canCancelInGrace(state({ submit: undefined }))).toBe(false)
  })
})
