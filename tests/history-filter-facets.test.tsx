// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterChoices } from '@/features/history/filters/FilterChoices'
import { useHistoryFacets } from '@/lib/api/history-facets'

vi.mock('@/lib/api/history-facets', () => {
  return { useHistoryFacets: vi.fn() }
})

const mockFacets = vi.mocked(useHistoryFacets)

beforeEach(() => {
  mockFacets.mockReturnValue({
    isLoading: false,
    facets: {
      kind: 'video',
      models: [
        {
          presetId: 'custom.cu1.wan22',
          title: 'Wan 2.2 I2V',
          badge: 'CU1',
          count: 4,
          lastAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      resolutions: ['720p'],
      aspects: ['16:9'],
    },
  })
})

afterEach(() => {
  cleanup()
})

describe('history filter facets', () => {
  it('lists models with badge and count, including a deleted endpoint', () => {
    render(<FilterChoices />)

    expect(screen.getByText('[CU1] Wan 2.2 I2V (4)')).toBeTruthy()
  })

  it('uses the facet resolutions and aspects', () => {
    render(<FilterChoices />)

    expect(screen.getByRole('button', { name: '720p' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '16:9' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '480p' })).toBeNull()
  })

  it('falls back to the static models while facets load', () => {
    mockFacets.mockReturnValue({ isLoading: true, facets: undefined })

    render(<FilterChoices />)

    expect(screen.getByRole('button', { name: 'Wan 3.0' })).toBeTruthy()
  })
})
