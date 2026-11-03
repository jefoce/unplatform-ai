import { describe, expect, it } from 'vitest'

import { costInfo } from '@/features/history/details/details-info'

import type {
  GenerationCost,
  GenerationRecord,
  JobStatus,
} from '../src/core/schemas/generation-record'
import { record } from './helpers/history'

interface CostParams {
  status: JobStatus
  cost: Partial<GenerationCost>
}

function withCost(params: CostParams): GenerationRecord {
  const base = record('v')

  return { ...base, status: params.status, cost: { ...base.cost, ...params.cost } }
}

const REPORTED = { estimatedUsd: 0.3, pricePerSec: 0.1 }

describe('video cost info', () => {
  it('marks a failed unreported cost as an estimate', () => {
    expect(
      costInfo(withCost({ status: 'failed', cost: { ...REPORTED, actualUsd: null } })),
    ).toEqual({
      text: '≈ $0.30',
      note: 'Cost not reported',
    })
  })

  it('marks an expired unreported cost as an estimate', () => {
    expect(
      costInfo(withCost({ status: 'expired', cost: { ...REPORTED, actualUsd: null } })),
    ).toEqual({
      text: '≈ $0.30',
      note: 'Cost not reported',
    })
  })

  it('shows a reported zero on a failed record', () => {
    expect(costInfo(withCost({ status: 'failed', cost: { ...REPORTED, actualUsd: 0 } }))).toEqual({
      text: '$0.00',
      note: '',
    })
  })

  it('shows the actual cost on an expired record', () => {
    expect(
      costInfo(withCost({ status: 'expired', cost: { ...REPORTED, actualUsd: 0.25 } })),
    ).toEqual({
      text: '$0.25',
      note: '',
    })
  })

  it('shows not billed when cancelled before submit', () => {
    expect(
      costInfo(withCost({ status: 'cancelled', cost: { ...REPORTED, actualUsd: null } })),
    ).toEqual({ text: 'Not billed', note: '' })
  })

  it('keeps the estimate and rate note on a completed record', () => {
    expect(
      costInfo(withCost({ status: 'completed', cost: { ...REPORTED, actualUsd: 0.25 } })),
    ).toEqual({ text: '$0.25', note: '≈ $0.30 / $0.10/s' })
  })

  it('shows only the estimate while the job runs', () => {
    expect(
      costInfo(withCost({ status: 'in_progress', cost: { ...REPORTED, actualUsd: null } })),
    ).toEqual({ text: '≈ $0.30', note: '' })
  })
})
