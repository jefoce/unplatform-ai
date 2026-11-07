// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DetailsSource } from '@/features/history/details/DetailsSource'
import type * as EndpointsStatusModule from '@/lib/api/endpoints-status'
import { type EndpointStatusEntry, useEndpointsStatus } from '@/lib/api/endpoints-status'

import { storedRecord } from './helpers/stored-record'

vi.mock('@/lib/api/endpoints-status', async (importOriginal) => {
  const actual = await importOriginal<typeof EndpointsStatusModule>()

  return { ...actual, useEndpointsStatus: vi.fn() }
})

const mockEndpoints = vi.mocked(useEndpointsStatus)

function endpoint(): EndpointStatusEntry {
  return {
    id: 'cu1',
    label: 'Studio PC',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    status: 'ok',
    videoCount: 1,
    imageCount: 1,
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
  mockEndpoints.mockReturnValue({ endpoints: [endpoint()], isLoading: false })
})

afterEach(() => {
  cleanup()
})

describe('custom details source', () => {
  it('shows the workflow and endpoint snapshot', () => {
    render(<DetailsSource record={customRecord()} />)

    expect(screen.getByText('Workflow: Wan 2.2')).toBeTruthy()
    expect(screen.getByText('Endpoint: Studio PC')).toBeTruthy()
  })

  it('marks a deleted endpoint', () => {
    mockEndpoints.mockReturnValue({ endpoints: [], isLoading: false })

    render(<DetailsSource record={customRecord()} />)

    expect(screen.getByText('Endpoint: Studio PC (removed)')).toBeTruthy()
  })

  it('renders nothing for an OpenRouter record', () => {
    const { container } = render(<DetailsSource record={storedRecord('plain')} />)

    expect(container.textContent).toBe('')
  })
})
