import { clickLabelPrefix, openApp, resetLocal } from '../lib/dom.mjs'

const WAIT_MS = 15_000

/** Vertical centers of the badge, text block and menu of every endpoint row. */
async function measureRows(driver) {
  return driver.evaluate(`(() => {
    return window.__e2e.all('[data-endpoint-row]').map((row) => {
      const parts = [
        row.querySelector('[data-endpoint-badge]'),
        row.querySelector('[data-endpoint-text]'),
        row.querySelector('[aria-label="Endpoint menu"]'),
      ]
      if (parts.some((part) => part === null)) return null
      const centers = parts.map((part) => {
        const rect = part.getBoundingClientRect()
        return Math.round((rect.top + rect.height / 2) * 100) / 100
      })
      const delta = Math.round((Math.max(...centers) - Math.min(...centers)) * 100) / 100
      return { centers, delta }
    })
  })()`)
}

async function assertAligned(driver, label) {
  const rows = await measureRows(driver)

  if (rows.length === 0 || rows.some((row) => row === null)) {
    throw new Error(`Endpoint rows are missing their badge, text or menu (${label})`)
  }

  for (const [index, row] of rows.entries()) {
    if (row.delta > 1) {
      throw new Error(
        `Endpoint row ${String(index + 1)} misaligned (${label}): ${JSON.stringify(row.centers)}`,
      )
    }

    console.log(
      `# ${label} row ${String(index + 1)} centers ${row.centers.join(', ')} delta ${String(row.delta)}`,
    )
  }
}

async function scrollRow(driver, index) {
  await driver.evaluate(`(() => {
    const row = window.__e2e.all('[data-endpoint-row]').at(${String(index)})
    row.scrollIntoView({ block: 'center' })
  })()`)
  await new Promise((resolve) => {
    setTimeout(resolve, 150)
  })
}

async function shoot(driver, name) {
  const file = await driver.captureScreenshot(name)

  console.log(`# screenshot ${file}`)
}

async function editFirstRow(driver) {
  const clicked = await driver.evaluate(`(() => {
    const button = document.querySelector('[data-endpoint-row] button[aria-expanded]')
    if (button === null) return false
    button.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error('No endpoint row toggle')
  }

  await driver.waitFor(
    `window.__e2e.exists('[data-endpoint-row] input')`,
    WAIT_MS,
    'the expanded endpoint form',
  )
}

async function removeFirstRow(driver) {
  await clickLabelPrefix(driver, 'Endpoint menu')
  await driver.waitFor(
    `window.__e2e.all('[role="menuitem"], button').some((node) => node.innerText.trim() === 'Delete')`,
    WAIT_MS,
    'the endpoint menu',
  )
  await driver.clickText('Delete')
  await driver.waitFor(
    `window.__e2e.exists('[data-endpoint-removed]')`,
    WAIT_MS,
    'the removed notice',
  )
}

async function endpointAlignment(context) {
  const { driver, width } = context
  const suffix = String(width)

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view', 'unplatform-ai:draft'])
  await clickLabelPrefix(driver, 'Settings')
  await driver.waitFor(`window.__e2e.exists('[data-endpoint-row]')`, WAIT_MS, 'the endpoint rows')
  await scrollRow(driver, 0)

  await assertAligned(driver, `collapsed ${suffix}`)
  await shoot(driver, `settings-endpoints-collapsed-${suffix}`)

  await scrollRow(driver, -1)
  await assertAligned(driver, `unreachable ${suffix}`)
  await shoot(driver, `settings-endpoints-unreachable-${suffix}`)

  await scrollRow(driver, 0)
  await editFirstRow(driver)
  await assertAligned(driver, `expanded ${suffix}`)
  await shoot(driver, `settings-endpoints-expanded-${suffix}`)

  await removeFirstRow(driver)
  await assertAligned(driver, `removed ${suffix}`)
  await shoot(driver, `settings-endpoints-removed-${suffix}`)
}

async function rowCount(driver) {
  return driver.evaluate(`window.__e2e.all('[data-endpoint-row]').length`)
}

async function firstBadge(driver) {
  return driver.evaluate(
    `(window.__e2e.text('[data-endpoint-row] [data-endpoint-badge]') ?? '').trim()`,
  )
}

async function removeAndUndo(context) {
  const { driver, width } = context
  const suffix = String(width)

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view', 'unplatform-ai:draft'])
  await clickLabelPrefix(driver, 'Settings')
  await driver.waitFor(`window.__e2e.exists('[data-endpoint-row]')`, WAIT_MS, 'the endpoint rows')
  await scrollRow(driver, 0)

  const before = await rowCount(driver)
  const badge = await firstBadge(driver)

  if (before === 0) {
    throw new Error('No endpoint rows before delete')
  }

  if (badge === '') {
    throw new Error('First endpoint row has no badge')
  }

  await removeFirstRow(driver)
  await driver.waitFor(
    `window.__e2e.all('[data-endpoint-row]').length === ${String(before - 1)}`,
    WAIT_MS,
    'the row to leave the list',
  )
  await driver.waitFor(
    `(window.__e2e.text('[data-endpoint-removed]') ?? '').includes(${JSON.stringify(`${badge} removed.`)})`,
    WAIT_MS,
    'the removed notice text',
  )
  await shoot(driver, `settings-endpoint-removed-${suffix}`)

  const undone = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.trim() === 'Undo')
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!undone) {
    throw new Error('No Undo button in the removed notice')
  }

  await driver.waitFor(
    `window.__e2e.all('[data-endpoint-row]').length === ${String(before)}`,
    WAIT_MS,
    'the row to return',
  )
  await driver.waitFor(
    `!window.__e2e.exists('[data-endpoint-removed]')`,
    WAIT_MS,
    'the notice to disappear',
  )
  await shoot(driver, `settings-endpoint-restored-${suffix}`)
}

export const settingsCases = [
  {
    name: 'settings/endpoint-alignment',
    run: endpointAlignment,
  },
  {
    name: 'settings/endpoint-remove',
    run: removeAndUndo,
  },
]
