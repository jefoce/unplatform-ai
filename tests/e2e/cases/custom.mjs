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
const SCALE_MODEL = 'MiniMax H3 Scale (local)'
const SCALE_CARD = `[CU1] ${SCALE_MODEL}`
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

async function selectScaleModel(driver) {
  const row = `window.__e2e.all('button').some((node) => node.innerText.includes('CU1') && node.innerText.includes(${JSON.stringify(SCALE_MODEL)}))`

  await driver.waitFor(row, WAIT_MS, `the ${SCALE_MODEL} row`)

  const selected = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('CU1') && node.innerText.includes(${JSON.stringify(SCALE_MODEL)}))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No custom scale model row: ${SCALE_MODEL}`)
  }

  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker to close',
  )
}

async function customResolutionLabels(context) {
  const { driver } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await selectScaleModel(driver)
  await waitBodyText(driver, SCALE_CARD, WAIT_MS)

  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('1280×736'))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!opened) {
    throw new Error('No resolution trigger for the scale model')
  }

  await driver.waitFor(
    `window.__e2e.exists('[data-radix-popper-content-wrapper]')`,
    WAIT_MS,
    'the resolution popover',
  )
  await driver.waitFor(
    `(() => {
      const wrapper = document.querySelector('[data-radix-popper-content-wrapper]')
      return wrapper !== null && wrapper.innerText.includes('1280×736') && wrapper.innerText.includes('0.9')
    })()`,
    WAIT_MS,
    'the 1280x736 option with its 0.9 detail',
  )
}

async function resolutionPopoverHeight(context) {
  const { driver } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await selectScaleModel(driver)
  await waitBodyText(driver, SCALE_CARD, WAIT_MS)

  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('1280×736'))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!opened) {
    throw new Error('No resolution trigger for the scale model')
  }

  await driver.waitFor(
    `window.__e2e.exists('[data-radix-popper-content-wrapper]')`,
    WAIT_MS,
    'the resolution popover',
  )
  await driver.waitFor(
    `(() => {
      const wrapper = document.querySelector('[data-radix-popper-content-wrapper]')
      const content = wrapper === null ? null : wrapper.firstElementChild
      if (!(content instanceof HTMLElement)) return false
      const selected = content.querySelector('[data-selected="true"]')
      if (!(selected instanceof HTMLElement)) return false
      const box = content.getBoundingClientRect()
      const row = selected.getBoundingClientRect()
      return row.top >= box.top - 1 && row.bottom <= box.bottom + 1
    })()`,
    WAIT_MS,
    'the selected resolution row inside the scroll box',
  )

  const geometry = await driver.evaluate(`(() => {
    const wrapper = document.querySelector('[data-radix-popper-content-wrapper]')
    const content = wrapper === null ? null : wrapper.firstElementChild
    if (!(content instanceof HTMLElement)) return null
    const box = content.getBoundingClientRect()
    return {
      top: box.top,
      bottom: box.bottom,
      viewportHeight: window.innerHeight,
      optionCount: content.querySelectorAll('button').length,
    }
  })()`)

  if (geometry === null) {
    throw new Error('No resolution popover content')
  }

  if (geometry.top < 8) {
    throw new Error(`Resolution popover top ${String(geometry.top)} is above 8`)
  }

  if (geometry.bottom > geometry.viewportHeight - 8) {
    throw new Error(
      `Resolution popover bottom ${String(geometry.bottom)} passes ${String(geometry.viewportHeight - 8)}`,
    )
  }

  if (geometry.optionCount !== 14) {
    throw new Error(`Resolution popover shows ${String(geometry.optionCount)} options, expected 14`)
  }

  await shoot(driver, 'resolution-popover-720')
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
  {
    name: 'custom-endpoint/resolution-labels',
    run: customResolutionLabels,
  },
  {
    name: 'custom-endpoint/resolution-popover-height',
    run: resolutionPopoverHeight,
  },
]
