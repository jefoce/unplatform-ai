import { openApp } from '../lib/dom.mjs'

const NEW_BALANCE = 12.34
const NEW_BALANCE_TEXT = `$${NEW_BALANCE.toFixed(2)}`
const OLD_BALANCE_TEXT = '$0.00'

async function newestAfterPopoverClose(context) {
  const { driver } = context

  await openApp(context)

  await driver.waitFor(
    `window.__e2e.all('button').some((node) => node.innerText.trim() === ${JSON.stringify(OLD_BALANCE_TEXT)})`,
    30_000,
    'the initial credits badge',
  )

  await driver.evaluate(`(() => {
    const badge = window.__e2e.all('button').find((node) => node.innerText.trim() === ${JSON.stringify(OLD_BALANCE_TEXT)})
    badge.click()
  })()`)

  await driver.waitFor(
    `window.__e2e.all('button').some((node) => node.innerText.trim() === 'Refresh')`,
    10_000,
    'the credits popover',
  )

  await driver.evaluate(`(() => {
    const original = window.fetch
    const payload = {
      balance: ${String(NEW_BALANCE)},
      keyLimitRemaining: 0,
      keyLimit: 0,
      usageDaily: 0,
      usageMonthly: 0,
      localSpent: 0,
      localSpentUnknown: 0,
      source: 'mock',
      fetchedAt: new Date().toISOString(),
    }
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/api/credits?fresh=1')) {
        return Promise.resolve(new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }))
      }
      return original.call(window, input, init)
    }
  })()`)

  await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.trim() === 'Refresh')
    button.click()
  })()`)

  await driver.waitFor(
    `window.__e2e.all('button').some((node) => node.innerText.trim() === ${JSON.stringify(NEW_BALANCE_TEXT)})`,
    10_000,
    'the refreshed credits badge',
  )

  await driver.evaluate(`(() => {
    const badge = window.__e2e.all('button').find((node) => node.innerText.trim() === ${JSON.stringify(NEW_BALANCE_TEXT)})
    badge.click()
  })()`)

  await driver.waitFor(
    `!window.__e2e.exists('[role="dialog"]')`,
    10_000,
    'the credits popover to close',
  )

  const badgeText = await driver.evaluate(`(() => {
    const badge = window.__e2e.all('button').find((node) => /^\\$/.test(node.innerText.trim()))
    return badge?.innerText.trim() ?? ''
  })()`)

  if (badgeText !== NEW_BALANCE_TEXT) {
    throw new Error(`The badge shows ${badgeText} instead of ${NEW_BALANCE_TEXT}`)
  }

  console.log(`# credits badge after close: ${badgeText}`)
}

export const creditsCases = [
  {
    name: 'credits/newest-after-popover-close',
    run: newestAfterPopoverClose,
  },
]
