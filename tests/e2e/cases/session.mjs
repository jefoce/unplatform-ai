import fs from 'node:fs/promises'
import path from 'node:path'

import { TEMP_BASE } from '../lib/cdp.mjs'
import { startServer } from '../lib/server.mjs'

const SESSION_REQUIRED_TEXT = 'Open the link printed in the terminal where the server runs.'
const APP_SHELL =
  "window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')"

async function clearCookies(driver) {
  await driver.send('Network.clearBrowserCookies')
}

async function waitForShell(driver, label) {
  await driver.waitFor(APP_SHELL, 30_000, `the app shell ${label}`)
}

function assertNoOutbound(server) {
  const blocked = server.logs.join('').match(/\[e2e-outbound\] blocked \S+/g) ?? []

  if (blocked.length > 0) {
    throw new Error(`Outbound request blocked: ${blocked[0]}`)
  }
}

async function run(context) {
  const { driver } = context
  const storageRoot = await fs.mkdtemp(path.join(TEMP_BASE, 'browser-session-'))
  let server = await startServer({ browserMode: true, storageRoot })
  let restarted = null

  try {
    await clearCookies(driver)
    await driver.navigate(server.baseUrl)
    await driver.waitFor(
      `document.body.innerText.includes(${JSON.stringify(SESSION_REQUIRED_TEXT)})`,
      30_000,
      'the printed-link page',
    )

    const body = await driver.evaluate('document.body.innerText')

    if (body.includes("Couldn't load.")) {
      throw new Error('The feed error showed instead of the printed-link page')
    }

    await driver.navigate(server.sessionUrl)
    await waitForShell(driver, 'after the session URL')
    await driver.waitFor('location.pathname === "/"', 30_000, 'the feed after the session URL')

    await server.stop()
    assertNoOutbound(server)

    restarted = await startServer({ browserMode: true, storageRoot })
    await driver.navigate(restarted.baseUrl)
    await waitForShell(driver, 'after the restart')

    await driver.navigate(`http://localhost:${String(restarted.port)}/`)
    await waitForShell(driver, 'after localhost')

    const href = await driver.evaluate('location.href')

    if (!href.startsWith(`http://127.0.0.1:${String(restarted.port)}/`)) {
      throw new Error(`localhost did not redirect to 127.0.0.1: ${href}`)
    }
  } finally {
    await Promise.allSettled([server.stop(), restarted?.stop()])
    await fs.rm(storageRoot, { recursive: true, force: true })
  }
}

export const sessionCases = [
  {
    name: 'session/browser-mode',
    run,
  },
]
