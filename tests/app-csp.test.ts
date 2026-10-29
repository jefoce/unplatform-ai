import { describe, expect, it } from 'vitest'

import nextConfig, { APP_CSP, APP_CSP_DEV } from '../next.config'

const DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-ancestors 'none'",
]

const DEV_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self' ipc: http://ipc.localhost",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "font-src 'self'",
  "frame-ancestors 'none'",
]

describe('app page CSP', () => {
  it('sets every directive without eval in the production policy', () => {
    expect(APP_CSP.split('; ')).toEqual(DIRECTIVES)
    expect(APP_CSP).not.toContain('unsafe-eval')
  })

  it('adds eval to script-src only in the dev policy', () => {
    expect(APP_CSP_DEV.split('; ')).toEqual(DEV_DIRECTIVES)
    expect(APP_CSP_DEV.replace(" 'unsafe-eval'", '')).toBe(APP_CSP)
  })

  it('sets the policy on the document route', async () => {
    const entries = await nextConfig.headers?.()

    const root = entries?.find((entry) => {
      return entry.source === '/'
    })

    const header = root?.headers.find((item) => {
      return item.key === 'Content-Security-Policy'
    })

    expect([APP_CSP, APP_CSP_DEV]).toContain(header?.value)
  })
})
