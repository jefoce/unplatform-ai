import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as hostRedirect } from '../src/app/host-redirect/route'
import proxy from '../src/proxy'

const session = vi.hoisted(() => {
  return { desktop: false, valid: false }
})

vi.mock('../src/server/session', () => {
  return {
    desktopMode: () => {
      return session.desktop
    },
    hasSession: (request: { headers: Headers }) => {
      // The browser stores the cookie for 127.0.0.1 only.
      return session.valid && request.headers.get('host')?.startsWith('127.0.0.1') === true
    },
  }
})

function requestAt(url: string): NextRequest {
  const target = new URL(url)

  return new NextRequest(target, { headers: { host: target.host } })
}

function request(path: string): NextRequest {
  return requestAt(`http://127.0.0.1:3000${path}`)
}

function aliasRequest(path: string): NextRequest {
  return requestAt(`http://localhost:3000${path}`)
}

function redirectTarget(response: Response): URL {
  return new URL(response.headers.get('location') ?? '')
}

function rewriteTarget(response: Response): URL {
  return new URL(response.headers.get('x-middleware-rewrite') ?? '')
}

function followRewrite(response: Response): URL {
  const hop = hostRedirect(new Request(rewriteTarget(response)))

  return redirectTarget(hop)
}

beforeEach(() => {
  session.desktop = false
  session.valid = false
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('development session gate', () => {
  it('redirects a page without a cookie and sets no cookie', () => {
    vi.stubEnv('NODE_ENV', 'development')

    const response = proxy(request('/'))
    const location = response.headers.get('location') ?? ''

    expect(response.status).toBe(307)
    expect(new URL(location).pathname).toBe('/session/required')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('lets a valid cookie reach the app', () => {
    vi.stubEnv('NODE_ENV', 'development')
    session.valid = true

    const response = proxy(request('/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('production session gate', () => {
  it('redirects a page without a cookie', () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = proxy(request('/'))
    const location = response.headers.get('location') ?? ''

    expect(response.status).toBe(307)
    expect(new URL(location).pathname).toBe('/session/required')
  })

  it('lets a valid cookie reach the app', () => {
    vi.stubEnv('NODE_ENV', 'production')
    session.valid = true

    expect(proxy(request('/')).status).toBe(200)
  })
})

describe('desktop session gate', () => {
  it('stays open without a cookie', () => {
    vi.stubEnv('NODE_ENV', 'production')
    session.desktop = true

    const response = proxy(request('/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})

describe('alias host session gate', () => {
  it('redirects localhost to the cookie host before the session gate', () => {
    session.valid = true

    const response = proxy(aliasRequest('/'))
    const target = followRewrite(response)

    expect(response.status).toBe(200)
    expect(target.href).toBe('http://127.0.0.1:3000/')
    expect(proxy(requestAt(target.href)).status).toBe(200)
  })

  it('redirects localhost to the cookie host, then to the session page', () => {
    const response = proxy(aliasRequest('/'))
    const target = followRewrite(response)

    expect(response.status).toBe(200)
    expect(target.href).toBe('http://127.0.0.1:3000/')

    const followed = proxy(requestAt(target.href))

    expect(followed.status).toBe(307)
    expect(redirectTarget(followed).pathname).toBe('/session/required')
    expect(redirectTarget(followed).host).toBe('127.0.0.1:3000')
  })

  it('does not bounce the session page on the alias host', () => {
    const response = proxy(aliasRequest('/session/required'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
