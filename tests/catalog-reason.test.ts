import { describe, expect, it } from 'vitest'

import {
  CATALOG_MISSING_REASON,
  CATALOG_STALE_REASON,
  CATALOG_UNREACHABLE_REASON,
  type CatalogEntry,
  catalogEntryReason,
} from '@/core/catalog'

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    modelId: 'wan22',
    presetId: 'custom.cu1.wan22',
    provider: 'custom',
    status: 'available',
    reason: null,
    pricing: null,
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

describe('catalog entry reason', () => {
  it('leaves a ready entry without a reason', () => {
    expect(catalogEntryReason(entry())).toBeNull()
  })

  it('maps unverified to the reachability hint', () => {
    expect(catalogEntryReason(entry({ status: 'unverified' }))).toBe(CATALOG_UNREACHABLE_REASON)
  })

  it('maps missing, no_provider and invalid to their reason or the gone hint', () => {
    expect(
      catalogEntryReason(entry({ status: 'missing', reason: 'Not available on OpenRouter.' })),
    ).toBe('Not available on OpenRouter.')

    expect(catalogEntryReason(entry({ status: 'no_provider' }))).toBe(CATALOG_MISSING_REASON)
    expect(catalogEntryReason(entry({ status: 'invalid' }))).toBe(CATALOG_MISSING_REASON)
  })

  it('turns a reason on an available entry into the stale hint', () => {
    expect(catalogEntryReason(entry({ reason: 'workflow changed' }))).toBe(CATALOG_STALE_REASON)
  })
})
