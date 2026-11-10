import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { MAX_JSON_BODY_BYTES } from '../src/core/constants'

vi.mock('@/server/providers/custom/endpoint-source', () => {
  return {
    getEndpointToken: () => {
      return null
    },
  }
})

const { requestJson } = await import('@/server/providers/custom/http')
const { runHealthProbe } = await import('@/server/providers/custom/health')

const ENDPOINT: CustomEndpoint = {
  id: 'ep1',
  label: 'ep1',
  badge: 'CU1',
  baseUrl: 'http://127.0.0.1:8188',
  enabled: true,
  pricing: { mode: 'model', usd: 0 },
  instanceId: null,
  lastHealth: null,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('custom JSON response cap', () => {
  it('parses a body under the cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return jsonResponse({ ok: true })
      }),
    )

    const value = await requestJson({
      endpoint: ENDPOINT,
      path: '/api/v1/health',
      init: {},
      timeoutMs: 10_000,
    })

    expect(value).toEqual({ ok: true })
  })

  it('rejects a body over the cap as a protocol error', async () => {
    const body = JSON.stringify({ text: 'a'.repeat(MAX_JSON_BODY_BYTES + 1) })

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await expect(
      requestJson({
        endpoint: ENDPOINT,
        path: '/api/v1/health',
        init: {},
        timeoutMs: 10_000,
      }),
    ).rejects.toMatchObject({ code: 'protocol' })
  })

  it('rejects an oversized error body as a protocol error', async () => {
    const body = JSON.stringify({ text: 'a'.repeat(MAX_JSON_BODY_BYTES + 1) })

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return new Response(body, {
          status: 500,
          headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
        })
      }),
    )

    await expect(
      requestJson({
        endpoint: ENDPOINT,
        path: '/api/v1/jobs',
        init: {},
        timeoutMs: 10_000,
      }),
    ).rejects.toMatchObject({ code: 'protocol' })
  })

  it('reports an oversized health body as a protocol failure', async () => {
    const body = JSON.stringify({ text: 'a'.repeat(MAX_JSON_BODY_BYTES + 1) })

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        return new Response(body, { status: 200 })
      }),
    )

    const probe = await runHealthProbe(ENDPOINT)

    expect(probe).toMatchObject({ ok: false, state: 'protocol' })
  })
})
