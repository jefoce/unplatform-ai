// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingsDraft } from '@/features/settings/use-settings-draft'

const mocks = vi.hoisted(() => {
  return {
    order: [] as string[],
    rowCount: 0,
    refreshedRowCount: 0,
    saveEndpoints: vi.fn(),
    reset: vi.fn(),
  }
})

vi.mock('@/lib/api/models', () => {
  return {
    refreshModels: vi.fn(async () => {
      mocks.order.push('models')
    }),
  }
})

vi.mock('@/lib/api/endpoints', () => {
  return {
    refreshEndpoints: vi.fn(async () => {
      mocks.order.push('endpoints')
      mocks.refreshedRowCount = 2
    }),
  }
})

vi.mock('@/lib/api/credits', () => {
  return { refreshCredits: vi.fn(async () => {}) }
})

vi.mock('@/lib/api/remote', () => {
  return { refreshRemoteStatus: vi.fn(async () => {}) }
})

vi.mock('@/lib/api/settings', () => {
  return { saveSecrets: vi.fn(async () => {}) }
})

vi.mock('@/features/settings/use-endpoints-draft', () => {
  return {
    useEndpointsDraft: () => {
      return {
        rows: Array.from({ length: mocks.rowCount }),
        nextBadge: 'CU2',
        isLoading: false,
        isDirty: true,
        isValid: true,
        onAdd: vi.fn(),
        onChange: vi.fn(),
        onTest: vi.fn(),
        onSave: mocks.saveEndpoints,
        reset: mocks.reset,
      }
    },
  }
})

vi.mock('@/features/settings/use-secret-actions', () => {
  return {
    useSecretActions: () => {
      return {
        results: {},
        testing: null,
        isRetrying: false,
        onTest: vi.fn(),
        onRetry: vi.fn(),
        resetResults: vi.fn(),
      }
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: {
      confirm: vi.fn(async () => {
        return true
      }),
    },
  }
})

vi.mock('@/lib/notify', () => {
  return { toastError: vi.fn() }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

beforeEach(() => {
  mocks.order.length = 0
  mocks.rowCount = 0
  mocks.refreshedRowCount = 0
  mocks.reset.mockReset()

  mocks.reset.mockImplementation(() => {
    mocks.order.push('reset')
    mocks.rowCount = mocks.refreshedRowCount
  })

  mocks.saveEndpoints.mockReset()
  mocks.saveEndpoints.mockResolvedValue(undefined)
})

describe('settings save refresh', () => {
  it('refreshes endpoints after models', async () => {
    const { result } = renderHook(() => {
      return useSettingsDraft({
        status: undefined,
        mock: true,
        isOpen: true,
        closeSettings: vi.fn(),
      })
    })

    await act(async () => {
      await result.current.onSave()
    })

    expect(mocks.saveEndpoints).toHaveBeenCalledTimes(1)
    expect(mocks.order).toEqual(['models', 'endpoints', 'reset'])
    expect(result.current.endpoints.rows).toHaveLength(2)
  })
})
