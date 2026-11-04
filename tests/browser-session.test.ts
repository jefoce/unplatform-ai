import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Dict } from '../src/core/utility-types'

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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('browser session', () => {
  it('rejects a write until the minted token is set', async () => {
    vi.resetModules()
    vi.stubEnv('APP_TOKEN', '')
    vi.stubEnv('APP_TOKEN_FILE', '')
    vi.stubEnv('STORAGE_ROOT', await mkdtemp(path.join(os.tmpdir(), 'cf-browser-session-')))

    const session = await import('@/server/session')
    const guard = await import('@/server/request-guard')
    const token = session.browserSessionUrl()?.split('#t=')[1] ?? ''

    expect(token).toHaveLength(64)

    const anonymous = makeRequest(
      { 'content-type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        guard.assertLocalRequest(anonymous)
      }),
    ).toBe(401)

    const withCookie = makeRequest(
      { 'content-type': 'application/json', cookie: `upai_session=${token}` },
      { method: 'POST', body: '{}' },
    )

    expect(
      statusOf(() => {
        guard.assertLocalRequest(withCookie)
      }),
    ).toBeNull()
  })
})
