import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogEntry, ModelCatalog } from '@/core/catalog'
import { findPreset, setRuntimeVideoPresets, VIDEO_PRESETS } from '@/core/presets'
import type { VideoPreset } from '@/core/presets/video/types'

const mocks = vi.hoisted(() => {
  return { fetcher: vi.fn(), mutate: vi.fn() }
})

vi.mock('@/lib/fetcher', () => {
  return { fetcher: mocks.fetcher }
})

vi.mock('swr', () => {
  return { default: vi.fn(), mutate: mocks.mutate }
})

const { refreshCatalog } = await import('@/lib/api/catalog')

function basePreset(): VideoPreset {
  const [base] = VIDEO_PRESETS

  if (isNil(base)) {
    throw new Error('base preset is missing')
  }

  return base
}

const PRESET: VideoPreset = {
  ...basePreset(),
  id: 'custom.refresh.model',
  title: 'Refresh Model',
  family: 'custom',
}

const ENTRY: CatalogEntry = {
  modelId: PRESET.id,
  presetId: PRESET.id,
  provider: 'custom',
  status: 'available',
  reason: null,
  pricing: null,
  availability: { status: 'available', reason: null },
  source: {
    kind: 'custom',
    instanceId: 'cu1',
    badge: 'CU1',
    workflowName: null,
    local: true,
  },
  preset: PRESET,
}

const CATALOG: ModelCatalog = {
  entries: [ENTRY],
  fetchedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  mocks.fetcher.mockReset()
  mocks.mutate.mockReset()
  mocks.mutate.mockResolvedValue(undefined)
  setRuntimeVideoPresets([])
})

afterEach(() => {
  setRuntimeVideoPresets([])
})

describe('refreshCatalog', () => {
  it('fetches a forced catalog and registers the new entries', async () => {
    mocks.fetcher.mockResolvedValue(CATALOG)

    await refreshCatalog()

    expect(mocks.fetcher).toHaveBeenCalledWith('/api/models?refresh=1')
    expect(findPreset(PRESET.id)).toBe(PRESET)
    expect(mocks.mutate).toHaveBeenCalledWith('/api/models', CATALOG, { revalidate: false })
  })
})
