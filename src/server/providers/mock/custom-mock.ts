import 'server-only'

import type { ProviderInstance } from '@/core/providers/types'

/** Demo instances for dev and e2e. Every job state is reachable from one of them. */
export function customMockInstances(): readonly ProviderInstance[] {
  return [
    { id: 'mock-ready', kind: 'custom', label: 'Mock ComfyUI', badge: 'CU1' },
    { id: 'mock-stale', kind: 'custom', label: 'Mock stale workflow', badge: 'CU2' },
    { id: 'mock-invalid', kind: 'custom', label: 'Mock invalid workflow', badge: 'CU3' },
    { id: 'mock-unreachable', kind: 'custom', label: 'Mock offline endpoint', badge: 'CU4' },
  ]
}
