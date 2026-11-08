// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EndpointOverviewEntry } from '@/core/api/endpoints'
import { DetailsSource } from '@/features/history/details/DetailsSource'
import {
  EndpointsStatusProvider,
  useEndpointsSnapshot,
} from '@/features/shared/endpoints-status-context'
import type * as EndpointsStatusModule from '@/lib/api/endpoints-status'
import { useEndpointsStatus } from '@/lib/api/endpoints-status'

import { storedRecord } from './helpers/stored-record'

vi.mock('@/lib/api/endpoints-status', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointsStatusModule>()

  return { ...actual, useEndpointsStatus: vi.fn() }
})

const mockStatus = vi.mocked(useEndpointsStatus)

function endpoint(): EndpointOverviewEntry {
  return {
    id: 'cu1',
    label: 'Studio PC',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    runningJobs: 0,
    status: 'ok',
    videoCount: 1,
    imageCount: 1,
    tokenHint: null,
    hasToken: false,
  }
}

function customRecord() {
  return storedRecord('custom-record', {
    provider: 'custom',
    source: {
      kind: 'custom',
      instanceId: 'cu1',
      badge: 'CU1',
      presetTitle: 'Wan 2.2 I2V',
      workflowName: 'Wan 2.2',
      endpointLabel: 'Studio PC',
      local: true,
    },
  })
}

beforeEach(() => {
  mockStatus.mockReturnValue({ endpoints: [], isLoading: false, error: null })
})

afterEach(() => {
  cleanup()
})

describe('endpoints snapshot context', () => {
  it('reports loading when rendered without the provider', () => {
    const { result } = renderHook(() => {
      return useEndpointsSnapshot()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.endpoints).toEqual([])
  })

  it('does not mark a custom endpoint removed without the provider', () => {
    render(<DetailsSource record={customRecord()} />)

    expect(screen.getByText('Endpoint: Studio PC')).toBeTruthy()
    expect(screen.queryByText('Endpoint: Studio PC (removed)')).toBeNull()
  })

  it('provides the snapshot from the endpoint status hook', () => {
    mockStatus.mockReturnValue({ endpoints: [endpoint()], isLoading: false, error: null })

    const { result } = renderHook(
      () => {
        return useEndpointsSnapshot()
      },
      { wrapper: EndpointsStatusProvider },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.endpoints).toEqual([endpoint()])
  })
})
