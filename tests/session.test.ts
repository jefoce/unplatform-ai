import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TOKEN = 'a'.repeat(64)

async function load(token?: string) {
  vi.resetModules()
  vi.stubEnv('APP_TOKEN', token ?? '')

  return import('@/server/session')
}

function makeRequest(cookie?: string): Request {
  const hasCookie = !isNil(cookie) && cookie !== ''

  return new Request('http://127.0.0.1:3000/', { headers: hasCookie ? { cookie } : {} })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session', () => {
  it('passes every request when APP_TOKEN is unset', async () => {
    const { hasSession, sessionRequired } = await load()

    expect(sessionRequired()).toBe(false)
    expect(hasSession(makeRequest())).toBe(true)
    expect(hasSession(makeRequest('upai_session=nope'))).toBe(true)
  })

  it('requires a session when APP_TOKEN is set', async () => {
    const { hasSession, sessionRequired } = await load(TOKEN)

    expect(sessionRequired()).toBe(true)
    expect(hasSession(makeRequest())).toBe(false)
  })

  it('rejects a wrong cookie and accepts the right one', async () => {
    const { hasSession } = await load(TOKEN)

    expect(hasSession(makeRequest('upai_session=wrong'))).toBe(false)
    expect(hasSession(makeRequest(`other=1; upai_session=${TOKEN}`))).toBe(true)
  })

  it('rejects tokens of a different length', async () => {
    const { tokenMatches } = await load(TOKEN)

    expect(tokenMatches('short')).toBe(false)
    expect(tokenMatches(null)).toBe(false)
    expect(tokenMatches(TOKEN)).toBe(true)
  })
})
