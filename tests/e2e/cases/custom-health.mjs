import { clickLabelPrefix, gotoTab, openApp, resetLocal, setPrompt } from '../lib/dom.mjs'

const WAIT_MS = 30_000
const ROW_WAIT_MS = 3_000
const SETTINGS_WAIT_MS = 5_000
const UNREACHABLE_ID = 'mock-unreachable'
const CU4_TITLE = 'Wan 2.2 I2V (local)'
const CU4_LABEL = 'Mock offline endpoint'
const CU1_TITLE = 'Wan 2.2 T2V (local)'
const UNREACHABLE_REASON = 'ComfyUI is not reachable.'
const CU4_PRESET_ID = 'custom.mock-unreachable.wan22-i2v'
const DRAFT_KEY = 'unplatform-ai:draft'

const CU4_DRAFT = {
  state: {
    presetId: CU4_PRESET_ID,
    tab: 'frames',
    prompts: { frames: '', references: '' },
    audio: false,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
  },
  version: 3,
}

async function setReachable(server, id, isReachable) {
  const response = await fetch(`${server.baseUrl}/api/dev/custom-mock/reachable`, {
    method: 'POST',
    headers: { cookie: `upai_session=${server.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id, isReachable }),
  })

  if (response.status !== 204) {
    throw new Error(`Reachable switch answered ${String(response.status)}`)
  }
}

async function setChecking(server, id) {
  const response = await fetch(`${server.baseUrl}/api/dev/custom-mock/reachable`, {
    method: 'POST',
    headers: { cookie: `upai_session=${server.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id, isChecking: true }),
  })

  if (response.status !== 204) {
    throw new Error(`Checking switch answered ${String(response.status)}`)
  }
}

async function openSettings(driver) {
  await clickLabelPrefix(driver, 'Settings')
  await driver.waitFor(
    `window.__e2e.all('[data-endpoint-row]').some((row) => row.innerText.includes(${JSON.stringify(CU4_LABEL)}))`,
    WAIT_MS,
    'the CU4 settings row',
  )
}

async function settingsRowText(driver) {
  return driver.evaluate(`(() => {
    const row = window.__e2e.all('[data-endpoint-row]').find((node) => node.innerText.includes(${JSON.stringify(CU4_LABEL)}))
    return row === undefined ? null : row.innerText
  })()`)
}

async function closeSettings(driver) {
  await driver.pressKey('Escape')
  await driver.waitFor(`!window.__e2e.exists('[data-endpoint-row]')`, WAIT_MS, 'Settings to close')
}

async function openModelPicker(driver) {
  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => /^Model\\b/.test(node.innerText.trim()))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!opened) {
    throw new Error('No model picker trigger')
  }

  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker',
  )
}

function rowExpression(badge, title) {
  return `window.__e2e.all('button').find((node) => node.hasAttribute('aria-pressed') && node.innerText.includes(${JSON.stringify(badge)}) && node.innerText.includes(${JSON.stringify(title)}))`
}

async function waitRow(driver, badge, title) {
  await driver.waitFor(
    `${rowExpression(badge, title)} !== undefined`,
    WAIT_MS,
    `the ${badge} ${title} row`,
  )
}

async function readRow(driver, badge, title) {
  return driver.evaluate(`(() => {
    const row = ${rowExpression(badge, title)}
    if (row === undefined) return null
    return { isDisabled: row.disabled, text: row.innerText }
  })()`)
}

async function readGenerateDisabled(driver) {
  return driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => /^GENERATE/i.test(node.innerText.trim()))
    return button !== undefined && button.disabled
  })()`)
}

async function seedUnreachableDraft(driver) {
  await driver.evaluate(
    `localStorage.setItem(${JSON.stringify(DRAFT_KEY)}, ${JSON.stringify(JSON.stringify(CU4_DRAFT))})`,
  )
  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-generator-panel]')`,
    WAIT_MS,
    'the generator after the draft reload',
  )
}

async function closePicker(driver) {
  await driver.pressKey('Escape')
  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker to close',
  )
}

async function customHealthDown(context) {
  const { driver, server } = context

  await setReachable(server, UNREACHABLE_ID, false)
  await openApp(context)
  await openSettings(driver)
  await driver.waitFor(
    `(() => {
      const row = window.__e2e.all('[data-endpoint-row]').find((node) => node.innerText.includes(${JSON.stringify(CU4_LABEL)}))
      return row !== undefined && row.innerText.includes('Unreachable')
    })()`,
    SETTINGS_WAIT_MS,
    'the CU4 settings row unreachable',
  )

  const settingsText = await settingsRowText(driver)

  if (settingsText === null || settingsText.includes('Checking…')) {
    throw new Error('The CU4 settings row shows Checking… after the probe failed')
  }

  await closeSettings(driver)

  await seedUnreachableDraft(driver)
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)

  await driver.waitFor(
    `(() => {
      const row = ${rowExpression('CU4', CU4_TITLE)}
      return row !== undefined && row.innerText.includes('unreachable') && row.innerText.includes(${JSON.stringify(UNREACHABLE_REASON)})
    })()`,
    ROW_WAIT_MS,
    'the CU4 unreachable row',
  )

  const downRow = await readRow(driver, 'CU4', CU4_TITLE)

  if (downRow === null || !downRow.isDisabled) {
    throw new Error('The CU4 row is not disabled while the endpoint is down')
  }

  if (!(await readGenerateDisabled(driver))) {
    throw new Error('Generate stays enabled while the selected endpoint is down')
  }

  await setReachable(server, UNREACHABLE_ID, true)
  await driver.click('[aria-label="Refresh models"]')
  await driver.waitFor(
    `(() => {
      const row = ${rowExpression('CU4', CU4_TITLE)}
      return row !== undefined && !row.disabled && !row.innerText.includes(${JSON.stringify(UNREACHABLE_REASON)})
    })()`,
    WAIT_MS,
    'the CU4 row to enable after the picker refresh',
  )

  await closePicker(driver)
}

async function customHealthUp(context) {
  const { driver } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await waitRow(driver, 'CU1', CU1_TITLE)

  const rows = await driver.evaluate(`(() => {
    return window.__e2e.all('button')
      .filter((node) => node.innerText.includes('CU1'))
      .map((node) => node.disabled)
  })()`)

  if (rows.length === 0 || rows.some(Boolean)) {
    throw new Error('A CU1 row is disabled while the demo endpoint is up')
  }

  const selected = await driver.evaluate(`(() => {
    const row = ${rowExpression('CU1', CU1_TITLE)}
    if (row === undefined) return false
    row.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No CU1 model row: ${CU1_TITLE}`)
  }

  await closePicker(driver)
  await setPrompt(driver, 'e2e healthy endpoint')
  await driver.waitFor(
    `(() => {
      const button = window.__e2e.all('button').find((node) => /^GENERATE/i.test(node.innerText.trim()))
      return button !== undefined && !button.disabled
    })()`,
    WAIT_MS,
    'Generate with a healthy demo endpoint',
  )
}

async function customHealthChecking(context) {
  const { driver, server } = context

  await setChecking(server, UNREACHABLE_ID)
  await openApp(context)
  await openSettings(driver)
  await driver.waitFor(
    `window.__e2e.all('[data-endpoint-row]').some((row) => row.innerText.includes(${JSON.stringify(CU4_LABEL)}) && row.innerText.includes('Checking…'))`,
    ROW_WAIT_MS,
    'the CU4 settings row checking',
  )
  await closeSettings(driver)

  await gotoTab(driver, 'Video')
  await setReachable(server, UNREACHABLE_ID, true)
  await openModelPicker(driver)
  await driver.click('[aria-label="Refresh models"]')
  await driver.waitFor(
    `(() => {
      const row = ${rowExpression('CU4', CU4_TITLE)}
      return row !== undefined && !row.disabled
    })()`,
    WAIT_MS,
    'the CU4 row to enable within the poll window',
  )
}

export const customHealthCases = [
  {
    name: 'custom-health/down',
    run: customHealthDown,
  },
  {
    name: 'custom-health/up',
    run: customHealthUp,
  },
  {
    name: 'custom-health/checking',
    run: customHealthChecking,
  },
]
