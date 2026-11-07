// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEndpointsDraft } from '@/features/settings/use-endpoints-draft'
import type { EndpointView } from '@/lib/api/endpoints'

import { required } from './helpers/required'

const mocks = vi.hoisted(() => {
  return {
    overview: { endpoints: [] as EndpointView[], nextBadge: 'CU2' },
    save: vi.fn(),
    test: vi.fn(),
  }
})

vi.mock('@/lib/api/endpoints', () => {
  return {
    ENDPOINTS_KEY: '/api/endpoints',
    fetchEndpoints: vi.fn(() => {
      return Promise.resolve(mocks.overview)
    }),
    saveEndpoints: mocks.save,
    testEndpoint: mocks.test,
  }
})

vi.mock('swr', () => {
  return {
    default: () => {
      return { data: mocks.overview }
    },
  }
})

const VIEW: EndpointView = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Studio',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: null,
  lastHealth: null,
  runningJobs: 0,
  status: 'unknown',
  videoCount: 0,
  imageCount: 0,
  tokenHint: null,
}

beforeEach(() => {
  mocks.overview = { endpoints: [VIEW], nextBadge: 'CU2' }
  mocks.save.mockReset()
  mocks.test.mockReset()
})

describe('endpoint draft save and cancel', () => {
  it('saves the edited endpoint list', async () => {
    const next = { ...VIEW, label: 'Renamed' }

    mocks.save.mockResolvedValue({ endpoints: [next], nextBadge: 'CU2' })

    const { result } = renderHook(() => {
      return useEndpointsDraft({ isOpen: true })
    })

    const first = required(result.current.rows[0], 'first row')

    act(() => {
      result.current.onChange(first.key, { label: 'Renamed' })
    })

    expect(result.current.isDirty).toBe(true)

    await act(async () => {
      await result.current.onSave()
    })

    expect(mocks.save).toHaveBeenCalledWith({
      endpoints: [
        expect.objectContaining({
          id: VIEW.id,
          label: 'Renamed',
          badge: 'CU1',
          baseUrl: VIEW.baseUrl,
        }),
      ],
    })

    expect(result.current.rows[0]?.label).toBe('Renamed')
    expect(result.current.isDirty).toBe(false)
  })

  it('discards the draft on reset', () => {
    const { result } = renderHook(() => {
      return useEndpointsDraft({ isOpen: true })
    })

    const first = required(result.current.rows[0], 'first row')

    act(() => {
      result.current.onChange(first.key, { label: 'Temp' })
    })

    expect(result.current.rows[0]?.label).toBe('Temp')

    act(() => {
      result.current.reset()
    })

    expect(result.current.rows[0]?.label).toBe('Studio')
    expect(result.current.isDirty).toBe(false)
  })
})
