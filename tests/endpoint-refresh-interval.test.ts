import { describe, expect, it } from 'vitest'

import type { EndpointOverview, EndpointOverviewEntry } from '@/core/api/endpoints'
import { endpointRefreshInterval } from '@/lib/api/endpoints-status'

const REFRESH_MS = 15_000

const ENDPOINT: EndpointOverviewEntry = {
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
  videoCount: 2,
  imageCount: 2,
  tokenHint: null,
  hasToken: false,
}

function overview(endpoints: EndpointOverviewEntry[]): EndpointOverview {
  return { endpoints, nextBadge: 'CU1' }
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
