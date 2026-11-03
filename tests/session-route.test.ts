import { afterEach, describe, expect, it, vi } from 'vitest'

const TOKEN = 'a'.repeat(64)

async function loadRoute() {
  vi.resetModules()
  vi.stubEnv('APP_TOKEN', TOKEN)
  vi.stubEnv('APP_TOKEN_FILE', '')

  return import('@/app/api/session/route')
}

function sessionRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1:3000/api/session', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3000',
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/session', () => {
  it('exchanges the token for an HttpOnly cookie', async () => {
    const { POST } = await loadRoute()
    const response = await POST(sessionRequest({ token: TOKEN }))

    expect(response.status).toBe(204)

    expect(response.headers.get('set-cookie')).toBe(
      `upai_session=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`,
    )
  })

  it('rejects a wrong token', async () => {
    const { POST } = await loadRoute()
    const response = await POST(sessionRequest({ token: 'wrong' }))

    expect(response.status).toBe(401)
  })

  it('rejects a cross-site request', async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      sessionRequest({ token: TOKEN }, { 'sec-fetch-site': 'cross-site' }),
    )

    expect(response.status).toBe(403)
  })

  it('requires a JSON body', async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      new Request('http://127.0.0.1:3000/api/session', {
        method: 'POST',
        headers: { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin' },
        body: '{}',
      }),
    )

    expect(response.status).toBe(415)
  })

  it('rejects a missing token field', async () => {
    const { POST } = await loadRoute()
    const response = await POST(sessionRequest({}))

    expect(response.status).toBe(400)
  })
})
