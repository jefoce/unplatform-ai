import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Dict } from '@/core/utility-types'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'

const URL_LOCAL = 'http://127.0.0.1:3000/api/test'

function makeRequest(
  headers: Dict<string>,
  init: { method?: string; body?: string } = {},
): Request {
  return new Request(URL_LOCAL, {
    method: init.method ?? 'GET',
    headers: { host: '127.0.0.1:3000', ...headers },
    ...(isNil(init.body) ? {} : { body: init.body }),
  })
}

function statusOf(fn: () => void): number | null {
  try {
    fn()

    return null
  } catch (error) {
    const status = (error as { status?: unknown }).status

    return typeof status === 'number' ? status : -1
  }
}

describe('assertLocalRequest', () => {
  it('accepts a local GET', () => {
    expect(
      statusOf(() => {
        assertLocalRequest(makeRequest({}))
      }),
    ).toBeNull()
  })

  it('accepts localhost and IPv6 hosts', () => {
    expect(
      statusOf(() => {
        assertLocalRequest(makeRequest({ host: 'localhost:3000' }))
      }),
    ).toBeNull()

    expect(
      statusOf(() => {
        assertLocalRequest(makeRequest({ host: '[::1]:3000' }))
      }),
    ).toBeNull()
  })

  it('rejects a foreign host with 403', () => {
    expect(
      statusOf(() => {
        assertLocalRequest(makeRequest({ host: 'evil.example' }))
      }),
    ).toBe(403)
  })

  it('rejects a cross-site POST with 403', () => {
    const request = makeRequest(
      { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        assertLocalRequest(request)
      }),
    ).toBe(403)
  })

  it('accepts a same-origin POST', () => {
    const request = makeRequest(
      { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        assertLocalRequest(request)
      }),
    ).toBeNull()
  })

  it('rejects a foreign origin with 403', () => {
    const request = makeRequest(
      { origin: 'https://evil.example', 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        assertLocalRequest(request)
      }),
    ).toBe(403)
  })
})

const APP_TOKEN = 'b'.repeat(64)

async function loadGuarded() {
  vi.resetModules()
  vi.stubEnv('APP_TOKEN', APP_TOKEN)

  return import('@/server/request-guard')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('assertLocalRequest session', () => {
  it('rejects a request without the cookie when desktop mode is on', async () => {
    const guard = await loadGuarded()

    expect(
      statusOf(() => {
        guard.assertLocalRequest(makeRequest({}))
      }),
    ).toBe(401)
  })

  it('accepts the right cookie', async () => {
    const guard = await loadGuarded()
    const request = makeRequest({ cookie: `upai_session=${APP_TOKEN}` })

    expect(
      statusOf(() => {
        guard.assertLocalRequest(request)
      }),
    ).toBeNull()
  })

  it('skips only the session check with session: false', async () => {
    const guard = await loadGuarded()

    expect(
      statusOf(() => {
        guard.assertLocalRequest(makeRequest({}), { session: false })
      }),
    ).toBeNull()

    expect(
      statusOf(() => {
        guard.assertLocalRequest(makeRequest({ host: 'evil.example' }), { session: false })
      }),
    ).toBe(403)

    const crossSite = makeRequest(
      { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        guard.assertLocalRequest(crossSite, { session: false })
      }),
    ).toBe(403)
  })
})

describe('readJsonBody', () => {
  it('rejects non-JSON content types with 415', async () => {
    const request = makeRequest({ 'content-type': 'text/plain' }, { method: 'POST', body: '{}' })

    await expect(readJsonBody(request)).rejects.toMatchObject({ status: 415 })
  })

  it('parses a JSON body', async () => {
    const request = makeRequest(
      { 'content-type': 'application/json' },
      { method: 'POST', body: '{"ok":true}' },
    )

    await expect(readJsonBody(request)).resolves.toEqual({ ok: true })
  })

  it('rejects malformed JSON with 400', async () => {
    const request = makeRequest(
      { 'content-type': 'application/json' },
      { method: 'POST', body: '{' },
    )

    await expect(readJsonBody(request)).rejects.toMatchObject({ status: 400 })
  })
})
