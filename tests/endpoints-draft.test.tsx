// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EndpointOverviewEntry, EndpointTestResult } from '@/core/api/endpoints'
import { useEndpointsDraft } from '@/features/settings/use-endpoints-draft'

import { required } from './helpers/required'

const mocks = vi.hoisted(() => {
  return {
    overview: { endpoints: [] as EndpointOverviewEntry[], nextBadge: 'CU2' },
    save: vi.fn(),
    test: vi.fn(),
  }
})

vi.mock('@/lib/api/endpoints', () => {
  return {
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

const VIEW: EndpointOverviewEntry = {
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
  hasToken: false,
}

const TEST_RESULT: EndpointTestResult = {
  ok: true,
  error: null,
  protocol: 1,
  serverVersion: '0.43.0',
  videoCount: 3,
  imageCount: 2,
  authRequired: false,
  lanAllowed: true,
  instanceId: '11111111-1111-4111-8111-111111111111',
  maxRunning: 2,
  lastHealth: {
    protocol: 1,
    serverVersion: '0.43.0',
    maxRunning: 2,
    lanAllowed: true,
    authRequired: false,
    maxUploadBytes: 100,
    checkedAt: '2024-06-01T00:00:00.000Z',
  },
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

  it('stays clean when a row only expands', () => {
    const { result } = renderHook(() => {
      return useEndpointsDraft({ isOpen: true })
    })

    const first = required(result.current.rows[0], 'first row')

    act(() => {
      result.current.onChange(first.key, { isExpanded: true })
    })

    expect(result.current.rows[0]?.isExpanded).toBe(true)
    expect(result.current.isDirty).toBe(false)
  })

  it('clears the test result when a tested field changes', async () => {
    mocks.test.mockResolvedValue(TEST_RESULT)

    const { result } = renderHook(() => {
      return useEndpointsDraft({ isOpen: true })
    })

    const first = required(result.current.rows[0], 'first row')

    await act(async () => {
      result.current.onTest(first.key)
    })

    await waitFor(() => {
      expect(result.current.rows[0]?.test).not.toBeNull()
    })

    expect(result.current.rows[0]?.lastHealth).toEqual(TEST_RESULT.lastHealth)

    act(() => {
      result.current.onChange(first.key, { baseUrl: 'http://127.0.0.1:9999' })
    })

    expect(result.current.rows[0]?.test).toBeNull()
    expect(result.current.rows[0]?.lastHealth).toBeNull()
    expect(result.current.rows[0]?.instanceId).toBeNull()
    expect(result.current.rows[0]?.status).toBe('unknown')
  })
})

describe('endpoint test race', () => {
  it('drops a result for a base URL the row no longer has', async () => {
    let resolveTest: ((result: EndpointTestResult) => void) | null = null

    mocks.test.mockImplementation(() => {
      return new Promise<EndpointTestResult>((resolve) => {
        resolveTest = resolve
      })
    })

    const { result } = renderHook(() => {
      return useEndpointsDraft({ isOpen: true })
    })

    const first = required(result.current.rows[0], 'first row')

    act(() => {
      result.current.onTest(first.key)
    })

    act(() => {
      result.current.onChange(first.key, { baseUrl: 'http://127.0.0.1:9999' })
    })

    await act(async () => {
      resolveTest?.(TEST_RESULT)
    })

    await waitFor(() => {
      expect(result.current.rows[0]?.isTesting).toBe(false)
    })

    expect(result.current.rows[0]?.test).toBeNull()
    expect(result.current.rows[0]?.lastHealth).toBeNull()
  })
})
