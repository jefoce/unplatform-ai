// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useProviderReady } from '@/features/generator/use-provider-ready'
import { useSecrets } from '@/features/settings/use-secrets'
import { useCredits } from '@/lib/api/credits'
import type * as EndpointsStatusModule from '@/lib/api/endpoints-status'
import {
  type EndpointStatusEntry,
  hasReadyEndpoint,
  useEndpointsStatus,
} from '@/lib/api/endpoints-status'
import { useModelEntry } from '@/lib/api/models'

import type { CatalogEntry } from '../src/core/catalog'

vi.mock('@/features/settings/use-secrets', () => {
  return { useSecrets: vi.fn() }
})

vi.mock('@/lib/api/credits', () => {
  return { useCredits: vi.fn() }
})

vi.mock('@/lib/api/models', () => {
  return {
    useModelEntry: vi.fn(() => {
      return null
    }),
  }
})

vi.mock('@/lib/api/endpoints-status', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointsStatusModule>()

  return { ...actual, useEndpointsStatus: vi.fn() }
})

const mockSecrets = vi.mocked(useSecrets)
const mockCredits = vi.mocked(useCredits)
const mockEntry = vi.mocked(useModelEntry)
const mockEndpoints = vi.mocked(useEndpointsStatus)

const STALE_REASON = 'Workflow changed in ComfyUI. Save it in ComfyUI, then refresh.'
const KEY_REASON = 'Add your OpenRouter key in Settings.'

function endpoint(overrides: Partial<EndpointStatusEntry> = {}): EndpointStatusEntry {
  return {
    id: 'cu1',
    label: 'Studio PC',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    status: 'ok',
    videoCount: 2,
    imageCount: 2,
    ...overrides,
  }
}

function customEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    modelId: 'wan22',
    presetId: 'custom.cu1.wan22',
    provider: 'custom',
    status: 'available',
    reason: null,
    pricing: null,
    availability: { status: 'available', reason: null },
    source: {
      kind: 'custom',
      instanceId: 'cu1',
      badge: 'CU1',
      workflowName: 'Wan',
      local: true,
    },
    ...overrides,
  }
}

function setKey(isSet: boolean): void {
  mockSecrets.mockReturnValue({
    status: {
      backend: 'keychain',
      loading: false,
      loadError: null,
      keys: { OPENROUTER_API_KEY: { set: isSet, source: null, hint: null } },
    },
  } as unknown as ReturnType<typeof useSecrets>)
}

beforeEach(() => {
  mockCredits.mockReturnValue({ credits: null } as unknown as ReturnType<typeof useCredits>)
  mockEntry.mockReturnValue(null)
  mockEndpoints.mockReturnValue({ endpoints: [], isLoading: false })
  setKey(false)
})

afterEach(() => {
  cleanup()
})

describe('ready gate', () => {
  it('stays closed without a key or a healthy endpoint', () => {
    const { result } = renderHook(() => {
      return useProviderReady('wan-3.0', 'video')
    })

    expect(result.current.isReady).toBe(false)
    expect(result.current.reason).toBe(KEY_REASON)
  })

  it('opens with one healthy custom endpoint and no OpenRouter key', () => {
    mockEndpoints.mockReturnValue({ endpoints: [endpoint()], isLoading: false })

    const { result } = renderHook(() => {
      return useProviderReady('custom.cu1.wan22', 'video')
    })

    expect(hasReadyEndpoint([endpoint()], 'video')).toBe(true)
    expect(result.current.isReady).toBe(true)
    expect(result.current.reason).toBeNull()
  })

  it('requires an image model for the image tab', () => {
    mockEndpoints.mockReturnValue({
      endpoints: [endpoint({ videoCount: 2, imageCount: 0 })],
      isLoading: false,
    })

    const { result } = renderHook(() => {
      return useProviderReady('custom.cu1.image', 'image')
    })

    expect(result.current.isReady).toBe(false)
  })

  it('reports an unreachable model before the key', () => {
    mockEndpoints.mockReturnValue({
      endpoints: [endpoint({ status: 'unreachable' })],
      isLoading: false,
    })

    mockEntry.mockReturnValue(
      customEntry({ status: 'unverified', availability: { status: 'unverified', reason: null } }),
    )

    const { result } = renderHook(() => {
      return useProviderReady('custom.cu1.wan22', 'video')
    })

    expect(result.current.reason).toBe('ComfyUI is not reachable.')
  })

  it('reports an invalid workflow with its reason', () => {
    mockEndpoints.mockReturnValue({ endpoints: [endpoint()], isLoading: false })

    const reason = 'This workflow cannot run in ComfyUI.'

    mockEntry.mockReturnValue(
      customEntry({
        status: 'invalid',
        reason,
        availability: { status: 'invalid', reason },
      }),
    )

    const { result } = renderHook(() => {
      return useProviderReady('custom.cu1.wan22', 'video')
    })

    expect(result.current.isReady).toBe(false)
    expect(result.current.reason).toBe(reason)
  })

  it('reports a stale workflow with the Generate hint', () => {
    mockEndpoints.mockReturnValue({ endpoints: [endpoint()], isLoading: false })

    mockEntry.mockReturnValue(
      customEntry({
        reason: 'Workflow changed in ComfyUI since the last save',
        availability: {
          status: 'available',
          reason: 'Workflow changed in ComfyUI since the last save',
        },
      }),
    )

    const { result } = renderHook(() => {
      return useProviderReady('custom.cu1.wan22', 'video')
    })

    expect(result.current.reason).toBe(STALE_REASON)
  })
})
