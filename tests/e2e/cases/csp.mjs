import { openApp } from '../lib/dom.mjs'

async function run(context) {
  const { driver } = context

  await openApp(context)
  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app after reload',
  )
  await driver.waitForIdle()

  const violations = await driver.evaluate('window.__cspViolations ?? []')

  if (violations.length > 0) {
    throw new Error(`CSP violations: ${JSON.stringify(violations)}`)
  }

  const policy = await driver.evaluate(
    `fetch('/', { credentials: 'include' }).then((response) => response.headers.get('content-security-policy'))`,
  )

  for (const expected of ["'nonce-", "frame-ancestors 'none'"]) {
    if (typeof policy !== 'string' || !policy.includes(expected)) {
      throw new Error(`Missing ${expected} in the / policy: ${String(policy)}`)
    }
  }

  if (policy.split('frame-ancestors').length !== 2) {
    throw new Error(`The / policy has more than one CSP header: ${String(policy)}`)
  }

  const apiPolicy = await driver.evaluate(
    `fetch('/api/health', { credentials: 'include' }).then((response) => response.headers.get('content-security-policy'))`,
  )

  if (typeof apiPolicy !== 'string' || !apiPolicy.includes("frame-ancestors 'none'")) {
    throw new Error(`Missing frame-ancestors in the API policy: ${String(apiPolicy)}`)
  }
}

export const cspCases = [
  {
    name: 'csp/no-securitypolicyviolation',
    run,
  },
]
