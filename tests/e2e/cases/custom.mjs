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

export const customCases = [
  {
    name: 'custom-endpoint/generate',
    run: customEndpointGenerate,
  },
]
