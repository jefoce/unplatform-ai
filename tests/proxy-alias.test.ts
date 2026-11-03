import { describe, expect, it, vi } from 'vitest'

import { aliasRedirectUrl, shouldAliasRedirect } from '../src/proxy'

vi.mock('../src/server/session', () => {
  return {
    desktopMode: () => {
      return false
    },
    hasSession: () => {
      return false
    },
  }
})

function allowed(pathname: string, host: string): boolean {
  return shouldAliasRedirect({ pathname, host })
}

describe('alias redirect', () => {
  it('leaves the session page on its own host', () => {
    expect(allowed('/session/required', 'localhost:3000')).toBe(false)
  })

  it('leaves the token page on its own host', () => {
    expect(allowed('/session', 'localhost:3000')).toBe(false)
  })

  it('sends a page on an alias host to the cookie host', () => {
    expect(allowed('/', 'localhost:3000')).toBe(true)
  })

  it('keeps the cookie host in place', () => {
    expect(allowed('/', '127.0.0.1:3000')).toBe(false)
  })

  it('keeps the query string when redirecting to the cookie host', () => {
    const target = aliasRedirectUrl({
      pathname: '/studio',
      search: '?model=veo&page=2',
      host: 'localhost:3000',
    })

    expect(target?.href).toBe('http://127.0.0.1:3000/studio?model=veo&page=2')
  })

  it('leaves API routes alone', () => {
    expect(allowed('/api/generations', 'localhost:3000')).toBe(false)
  })
})
