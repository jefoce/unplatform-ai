import {
  clickGenerate,
  gotoTab,
  openApp,
  resetLocal,
  setPrompt,
  waitBodyText,
} from '../lib/dom.mjs'
import { waitRecord } from '../lib/server.mjs'

const MODEL_TITLE = 'Wan 2.2 T2V (local)'
const MODEL_CARD = `[CU1] ${MODEL_TITLE}`
const STALE_MODEL = 'Wan 2.2 I2V (local)'
const STALE_REASON = 'Workflow changed in ComfyUI since the last save'
const INVALID_MODEL = 'Broken Image'
const WAIT_MS = 30_000

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

async function openImageModelPicker(driver) {
  await driver.click('[data-image-prompt-bar] [data-model-chip]')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the image model picker',
  )
}

async function waitPickerRow(driver, badge, title) {
  await driver.waitFor(
    `window.__e2e.all('button').some((node) => node.innerText.includes(${JSON.stringify(badge)}) && node.innerText.includes(${JSON.stringify(title)}))`,
    WAIT_MS,
    `the ${badge} ${title} row`,
  )
}

async function shoot(driver, name) {
  const file = await driver.captureScreenshot(name)

  console.log(`# screenshot ${file}`)
}

async function selectCustomModel(driver) {
  const row = `window.__e2e.all('button').some((node) => node.innerText.includes('CU1') && node.innerText.includes(${JSON.stringify(MODEL_TITLE)}))`

  await driver.waitFor(row, WAIT_MS, `the ${MODEL_TITLE} row`)

  const selected = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('CU1') && node.innerText.includes(${JSON.stringify(MODEL_TITLE)}))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No custom model row: ${MODEL_TITLE}`)
  }

  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker to close',
  )
}

async function firstRecordId(server) {
  const deadline = Date.now() + WAIT_MS

  while (Date.now() < deadline) {
    const result = await server.api('/api/generations')
    const [record] = result.items

    if (record !== undefined) {
      return record.id
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250)
    })
  }

  throw new Error('Timed out waiting for the custom record')
}

async function customEndpointGenerate(context) {
  const { driver, server } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await selectCustomModel(driver)
  await waitBodyText(driver, MODEL_CARD, WAIT_MS)

  await setPrompt(driver, `e2e custom ${String(Date.now())}`)
  await clickGenerate(driver)

  const id = await firstRecordId(server)

  await waitRecord(
    server,
    '/api/generations',
    id,
    (record) => {
      return record.status === 'completed'
    },
    'Completed',
  )
  await driver.waitFor(
    `window.__e2e.exists('#history-item-${id}')`,
    WAIT_MS,
    'the custom history card',
  )
  await waitBodyText(driver, MODEL_CARD, WAIT_MS)
}

async function customPickerRows(context) {
  const { driver, width } = context
  const suffix = String(width)

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await waitPickerRow(driver, 'CU2', STALE_MODEL)
  await shoot(driver, `custom-picker-stale-${suffix}`)

  const staleAlert = `[aria-label=${JSON.stringify(STALE_REASON)}]`

  await driver.hover(staleAlert)
  await driver.waitFor(
    `window.__e2e.exists('[role="tooltip"]')`,
    WAIT_MS,
    'the stale reason tooltip',
  )
  await shoot(driver, `custom-picker-stale-tooltip-${suffix}`)

  await driver.focus(staleAlert)

  const isAlertFocused = await driver.evaluate(
    `document.activeElement?.getAttribute('aria-label') === ${JSON.stringify(STALE_REASON)}`,
  )

  if (!isAlertFocused) {
    throw new Error('The stale alert icon is not focusable')
  }

  // First Escape closes the tooltip, the second closes the picker.
  await driver.pressKey('Escape')
  await driver.pressKey('Escape')
  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker to close',
  )

  await gotoTab(driver, 'Image')
  await openImageModelPicker(driver)
  await waitPickerRow(driver, 'CU3', INVALID_MODEL)
  await shoot(driver, `custom-picker-invalid-${suffix}`)
}

export const customCases = [
  {
    name: 'custom-endpoint/generate',
    run: customEndpointGenerate,
  },
  {
    name: 'custom-endpoint/picker-rows',
    run: customPickerRows,
  },
]
