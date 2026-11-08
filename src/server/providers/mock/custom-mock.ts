import 'server-only'

import type { ProviderInstance } from '@/core/providers/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { customMockFixtures } from './custom-fixtures'
import { type CustomMockCatalog, customMockCatalog, customMockScenario } from './custom-models'

const MOCK_BASE_URL = 'http://mock'

/** Demo instances for dev and e2e. Every job state is reachable from one of them. */
export function customMockInstances(): readonly ProviderInstance[] {
  return [
    { id: 'mock-ready', kind: 'custom', label: 'Mock ComfyUI', badge: 'CU1' },
    { id: 'mock-stale', kind: 'custom', label: 'Mock stale workflow', badge: 'CU2' },
    { id: 'mock-invalid', kind: 'custom', label: 'Mock invalid workflow', badge: 'CU3' },
    { id: 'mock-unreachable', kind: 'custom', label: 'Mock offline endpoint', badge: 'CU4' },
  ]
}

/** Catalog for one demo instance, resolved from its id suffix. */
export function customMockCatalogForInstance(instanceId: string): CustomMockCatalog {
  return customMockCatalog({ scenario: customMockScenario({ instanceId }) })
}

/** Demo endpoints, shaped like saved ones so Settings and submit share one path. */
export function customMockEndpoints(): readonly CustomEndpoint[] {
  return customMockInstances().map(customMockEndpoint)
}

export function customMockEndpoint(instance: ProviderInstance): CustomEndpoint {
  const health = customMockFixtures().health

  return {
    id: instance.id,
    label: instance.label,
    badge: instance.badge ?? 'CU',
    baseUrl: MOCK_BASE_URL,
    enabled: true,
    pricing: { mode: 'free', usd: 0 },
    instanceId: instance.id,
    lastHealth: {
      protocol: health.protocol,
      serverVersion: health.server_version,
      maxRunning: health.max_running,
      lanAllowed: health.lan_allowed,
      authRequired: health.auth_required,
      maxUploadBytes: health.max_upload_bytes,
      checkedAt: new Date().toISOString(),
    },
  }
}
