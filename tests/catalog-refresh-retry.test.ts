import { beforeEach, describe, expect, it, vi } from 'vitest'

const custom = vi.hoisted(() => {
  return {
    clearCustomCatalog: vi.fn(),
    ensureCustomCatalog: vi.fn(),
    findCustomPreset: vi.fn(),
    refreshCustomCatalog: vi.fn(),
  }
})

vi.mock('@/server/services/model-catalog-custom', () => {
  return custom
})

vi.mock('@/server/services/model-catalog-static', () => {
  return {
    STATIC_CATALOG_SOURCE: {
      kind: 'openrouter',
      instanceId: 'openrouter',
      badge: null,
      workflowName: null,
      local: false,
    },
    loadStaticEntries: vi.fn(async () => {
      return []
    }),
  }
})

vi.mock('@/server/services/endpoint-model-cache', () => {
  return { clearEndpointModelCache: vi.fn() }
})

vi.mock('@/server/secrets', () => {
  return { registerSecretsListener: vi.fn() }
})

const { findPresetAny } = await import('@/server/services/model-catalog')

const PRESET = { id: 'custom.ep.model' }

beforeEach(() => {
  custom.findCustomPreset.mockReset()
  custom.refreshCustomCatalog.mockReset()
})

describe('findCustomPresetAfterRefresh', () => {
  it('retries a refresh that a clear raced', async () => {
    const found = { preset: PRESET, source: { kind: 'custom', instanceId: 'ep' } }

    custom.findCustomPreset.mockReturnValueOnce(null).mockReturnValueOnce(found)

    custom.refreshCustomCatalog
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ entries: [], presets: [found] })

    const result = await findPresetAny(PRESET.id)

    expect(result).toBe(found)
    expect(custom.refreshCustomCatalog).toHaveBeenCalledTimes(2)
  })
})
