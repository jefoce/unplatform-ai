import { beforeEach, describe, expect, it, vi } from 'vitest'

const listGenerations = vi.hoisted(() => {
  return vi.fn()
})

const listImages = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/server/providers/registry', () => {
  return {
    getVideoProvider: () => {
      return {
        getAccount: async () => {
          return {
            balance: null,
            keyLimitRemaining: null,
            keyLimit: null,
            usageDaily: null,
            usageMonthly: null,
            source: 'mock',
            fetchedAt: '2026-01-01T00:00:00.000Z',
            error: null,
          }
        },
      }
    },
  }
})

vi.mock('@/server/repos/generations', () => {
  return { listGenerations }
})

vi.mock('@/server/repos/images', () => {
  return { listImages }
})

const { getCredits } = await import('@/server/services/credits')

interface Costed {
  cost: { actualUsd: number | null }
}

function recordWithCost(actualUsd: number | null): Costed {
  return { cost: { actualUsd } }
}

beforeEach(() => {
  listGenerations.mockReset()
  listImages.mockReset()
})

describe('local spend', () => {
  it('adds one video and one image actual cost', async () => {
    listGenerations.mockResolvedValue([recordWithCost(0.3)])
    listImages.mockResolvedValue([recordWithCost(0.2)])

    const credits = await getCredits()

    expect(credits.localSpent).toBeCloseTo(0.5)
  })

  it('skips records with no reported cost and counts them', async () => {
    listGenerations.mockResolvedValue([recordWithCost(null)])
    listImages.mockResolvedValue([recordWithCost(0.2)])

    const credits = await getCredits()

    expect(credits.localSpent).toBeCloseTo(0.2)
    expect(credits.localSpentUnknown).toBe(1)
  })

  it('sums known actuals and counts every unknown run', async () => {
    listGenerations.mockResolvedValue([recordWithCost(0.3), recordWithCost(null)])
    listImages.mockResolvedValue([recordWithCost(0.2), recordWithCost(null), recordWithCost(null)])

    const credits = await getCredits()

    expect(credits.localSpent).toBeCloseTo(0.5)
    expect(credits.localSpentUnknown).toBe(3)
  })
})
