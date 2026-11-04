import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config'
import { APP_CSP, APP_CSP_DEV, buildAppCsp } from '../src/lib/csp'

const DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
]

const DEV_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-eval'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
]

describe('app page CSP', () => {
  it('sets every directive without inline scripts or eval in production', () => {
    expect(APP_CSP.split('; ')).toEqual(DIRECTIVES)
    expect(APP_CSP).not.toContain('unsafe-eval')
  })

  it('adds eval to script-src only in the dev policy', () => {
    expect(APP_CSP_DEV.split('; ')).toEqual(DEV_DIRECTIVES)
    expect(APP_CSP_DEV.replace(" 'unsafe-eval'", '')).toBe(APP_CSP)
  })

  it('trusts a nonce and strict-dynamic for scripts', () => {
    const csp = buildAppCsp(false, 'abc123')

    const script = csp.split('; ').find((directive) => {
      return directive.startsWith('script-src')
    })

    expect(script).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(script).not.toContain('unsafe-inline')
  })
})

async function headerRules() {
  return (await nextConfig.headers?.()) ?? []
}

function keysOf(headers: { key: string }[]): string[] {
  return headers.map((header) => {
    return header.key
  })
}

describe('response headers', () => {
  it('leaves the page CSP to the proxy and keeps the framing guards', async () => {
    const page = (await headerRules()).find((rule) => {
      return rule.source === '/:path*'
    })

    expect(page).toBeDefined()

    expect(keysOf(page?.headers ?? [])).toEqual([
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-Frame-Options',
    ])
  })

  it('sends frame-ancestors on the API routes only', async () => {
    const api = (await headerRules()).find((rule) => {
      return rule.source === '/api/:path*'
    })

    const policy = api?.headers.find((header) => {
      return header.key === 'Content-Security-Policy'
    })

    expect(policy?.value).toBe("frame-ancestors 'none'")
  })
})

describe('desktop shell policy', () => {
  it('uses the app CSP and grants only the bound sidecar origin', () => {
    const config = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'))
    const capability = JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json', 'utf8'))
    const remote = JSON.parse(fs.readFileSync('src-tauri/capability-remote.json', 'utf8'))

    expect(config.app.security.csp).toBe(APP_CSP)
    expect(capability.remote).toBeUndefined()
    expect(remote.remote.urls).toEqual(['http://127.0.0.1:__PORT__/*'])
  })
})
