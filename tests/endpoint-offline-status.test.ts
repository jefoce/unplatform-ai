import { describe, expect, it } from 'vitest'

import type { EndpointHealthView, EndpointOverviewEntry } from '@/core/api/endpoints'
import { isEndpointOffline } from '@/lib/api/endpoints-status'

function entry(status: EndpointHealthView): EndpointOverviewEntry {
  return {
    id: 'cu1',
    label: 'Studio',
    badge: 'CU1',
    baseUrl: 'http://127.0.0.1:8188',
    enabled: true,
    pricing: { mode: 'model', usd: 0 },
    instanceId: null,
    lastHealth: null,
    runningJobs: 0,
    status,
    videoCount: 0,
    imageCount: 0,
    tokenHint: null,
    hasToken: false,
  }
}

describe('endpoint offline rule', () => {
  it('is false when no endpoint check exists yet', () => {
    expect(isEndpointOffline([], 'cu1')).toBe(false)
  })

  it('is false for ok, unknown and protocol', () => {
    for (const status of ['ok', 'unknown', 'protocol'] as const) {
      expect(isEndpointOffline([entry(status)], 'cu1')).toBe(false)
    }
  })

  it('is true for unreachable, forbidden and unauthorized', () => {
    for (const status of ['unreachable', 'forbidden', 'unauthorized'] as const) {
      expect(isEndpointOffline([entry(status)], 'cu1')).toBe(true)
    }
  })
})
