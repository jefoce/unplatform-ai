import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { freshPresetReason } from '@/lib/api/endpoints-status'

import type { CatalogEntry, ModelCatalog } from '../src/core/catalog'

const PRESET_ID = 'custom.cu1.wan22'

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    modelId: 'wan22',
    presetId: PRESET_ID,
    provider: 'custom',
    status: 'available',
    reason: null,
    pricing: null,
    availability: { status: 'available', reason: null },
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

function catalog(entries: CatalogEntry[]): ModelCatalog {
  return { entries, fetchedAt: '2026-01-01T00:00:00.000Z' }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface FetchRoutes {
  catalog: ModelCatalog
  endpointStatus?: string
  test?: { ok: boolean; error?: string | null }
}

function stubFetch(routes: FetchRoutes): ReturnType<typeof vi.fn> {
  const mock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)

    if (url === '/api/models') {
      return Promise.resolve(json(routes.catalog))
    }

    if (url === '/api/endpoints') {
      return Promise.resolve(
        json({
          endpoints: [
            {
              id: 'cu1',
              label: 'Studio PC',
              badge: 'CU1',
              baseUrl: 'http://127.0.0.1:8188',
              enabled: true,
              status: routes.endpointStatus ?? 'ok',
              videoCount: 1,
              imageCount: 1,
            },
          ],
        }),
      )
    }

    if (url === '/api/endpoints/test') {
      return Promise.resolve(json(routes.test ?? { ok: true, error: null }))
    }

    return Promise.resolve(new Response('not found', { status: 404 }))
  })

  vi.stubGlobal('fetch', mock)

  return mock
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fresh generate check', () => {
  it('is ready when health and the model pass', async () => {
    stubFetch({ catalog: catalog([entry()]) })

    expect(await freshPresetReason(PRESET_ID)).toBeNull()
  })

  it('returns the health error before submitting', async () => {
    stubFetch({
      catalog: catalog([entry()]),
      test: { ok: false, error: 'ComfyUI is not reachable.' },
    })

    expect(await freshPresetReason(PRESET_ID)).toBe('ComfyUI is not reachable.')
  })

  it('returns the missing reason without a health call', async () => {
    const fetchMock = stubFetch({
      catalog: catalog([
        entry({ status: 'missing', reason: 'This workflow is gone from ComfyUI.' }),
      ]),
    })

    expect(await freshPresetReason(PRESET_ID)).toBe('This workflow is gone from ComfyUI.')

    const urls = fetchMock.mock.calls.map(([input]) => {
      return String(input)
    })

    expect(urls).not.toContain('/api/endpoints/test')
  })

  it('returns the invalid reason without a health call', async () => {
    const reason = 'This workflow cannot run in ComfyUI.'

    const fetchMock = stubFetch({
      catalog: catalog([entry({ status: 'invalid', reason })]),
    })

    expect(await freshPresetReason(PRESET_ID)).toBe(reason)

    const urls = fetchMock.mock.calls.map(([input]) => {
      return String(input)
    })

    expect(urls).not.toContain('/api/endpoints/test')
  })

  it('returns the stale hint', async () => {
    stubFetch({ catalog: catalog([entry({ reason: 'workflow changed' })]) })

    expect(await freshPresetReason(PRESET_ID)).toBe(
      'Workflow changed in ComfyUI. Save it in ComfyUI, then refresh.',
    )
  })

  it('ignores OpenRouter presets', async () => {
    const fetchMock = stubFetch({ catalog: catalog([]) })

    expect(await freshPresetReason('wan-3.0')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
