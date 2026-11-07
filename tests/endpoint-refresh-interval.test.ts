import { describe, expect, it } from 'vitest'

import {
  endpointRefreshInterval,
  type EndpointsOverview,
  type EndpointStatusEntry,
} from '@/lib/api/endpoints-status'

const REFRESH_MS = 15_000

const ENDPOINT: EndpointStatusEntry = {
  id: 'cu1',
  label: 'Studio PC',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  status: 'ok',
  videoCount: 2,
  imageCount: 2,
}

function overview(endpoints: EndpointStatusEntry[]): EndpointsOverview {
  return { endpoints }
}

describe('endpointRefreshInterval', () => {
  it('stops polling before the first load and with no endpoints', () => {
    expect(endpointRefreshInterval(undefined)).toBe(0)
    expect(endpointRefreshInterval(overview([]))).toBe(0)
  })

  it('polls once at least one endpoint exists', () => {
    expect(endpointRefreshInterval(overview([ENDPOINT]))).toBe(REFRESH_MS)
    expect(endpointRefreshInterval(overview([ENDPOINT, ENDPOINT]))).toBe(REFRESH_MS)
  })
})
