import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'

const { owned } = vi.hoisted(() => {
  return { owned: new Set<string>() }
})

vi.mock('@/server/jobs/submit-queue', () => {
  return {
    isSubmitOwned: (id: string) => {
      return owned.has(id)
    },
    resumeGraceSubmits: vi.fn(),
  }
})

let needsInterruptFail: (record: GenerationRecord) => boolean

beforeAll(async () => {
  ;({ needsInterruptFail } = await import('@/server/jobs/reconcile'))
})

describe('needsInterruptFail', () => {
  it('keeps an owned uploading submit alive', () => {
    const record = makeRecord('11111111-1111-4111-8111-111111111111', 'uploading')

    owned.add(record.id)
    expect(needsInterruptFail(record)).toBe(false)
  })

  it('fails an unowned uploading submit regardless of age', () => {
    const record = makeRecord('22222222-2222-4222-8222-222222222222', 'uploading')

    expect(needsInterruptFail(record)).toBe(true)
  })

  it('fails an unowned sending submit', () => {
    const record = makeRecord('33333333-3333-4333-8333-333333333333', 'sending')

    expect(needsInterruptFail(record)).toBe(true)
  })

  it('leaves a grace submit alone', () => {
    const record = makeRecord('44444444-4444-4444-8444-444444444444', 'grace')

    expect(needsInterruptFail(record)).toBe(false)
  })

  it('leaves a submit with a job id alone', () => {
    const record = {
      ...makeRecord('55555555-5555-4555-8555-555555555555', 'sending'),
      job: { id: 'job-1', submittedAt: new Date().toISOString() },
    }

    expect(needsInterruptFail(record)).toBe(false)
  })
})

function makeRecord(
  id: string,
  stage: NonNullable<GenerationRecord['submit']>['stage'],
): GenerationRecord {
  const now = new Date().toISOString()

  return {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    provider: 'openrouter',
    input: {
      presetId: 'mock',
      tab: 'frames',
      prompt: '',
      audio: false,
      duration: 5,
      aspectRatio: 'auto',
      resolution: '720p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'mock', title: 'Mock', slug: 'mock' },
    inputsSnapshot: {},
    submit: { stage },
    seedUsed: null,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
}
