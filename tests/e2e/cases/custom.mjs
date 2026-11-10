import fs from 'node:fs/promises'

import {
  clickGenerate,
  dropFile,
  gotoTab,
  openApp,
  PNG_1PX,
  resetLocal,
  setPrompt,
  waitBodyText,
} from '../lib/dom.mjs'
import { waitRecord } from '../lib/server.mjs'

const AAC_BASE64 = (
  await fs.readFile(new URL('../../fixtures/media/sample.aac', import.meta.url))
).toString('base64')

const MODEL_TITLE = 'Wan 2.2 T2V (local)'
const MODEL_CARD = `[CU1] ${MODEL_TITLE}`
const SCALE_MODEL = 'MiniMax H3 Scale (local)'
const SCALE_CARD = `[CU1] ${SCALE_MODEL}`
const IMAGE_MODEL = 'SDXL Image (local)'
const IMAGE_CARD = `[CU1] ${IMAGE_MODEL}`
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

async function selectPickerRow(driver, badge, title) {
  const row = `window.__e2e.all('button').some((node) => node.innerText.includes(${JSON.stringify(badge)}) && node.innerText.includes(${JSON.stringify(title)}))`

  await driver.waitFor(row, WAIT_MS, `the ${title} row`)

  const selected = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes(${JSON.stringify(badge)}) && node.innerText.includes(${JSON.stringify(title)}))
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No ${badge} model row: ${title}`)
  }

  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    WAIT_MS,
    'the model picker to close',
  )
}

async function customResolutionLabels(context) {
  const { driver, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await waitBodyText(driver, '352\u20131088p', WAIT_MS)
  await shoot(driver, `video-picker-badges-${String(width)}`)
  await selectPickerRow(driver, 'CU1', SCALE_MODEL)
  await waitBodyText(driver, SCALE_CARD, WAIT_MS)

  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('736p'))
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
  await selectPickerRow(driver, 'CU1', SCALE_MODEL)
  await waitBodyText(driver, SCALE_CARD, WAIT_MS)

  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => node.innerText.includes('736p'))
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

  const showsPrice = await driver.evaluate(`(() => {
    const wrapper = document.querySelector('[data-radix-popper-content-wrapper]')
    if (wrapper === null) return null
    const text = wrapper.innerText
    return { hasDashes: text.includes('--'), hasFooter: text.includes('Saved rates') }
  })()`)

  if (showsPrice === null) {
    throw new Error('No resolution popover content')
  }

  if (showsPrice.hasDashes || showsPrice.hasFooter) {
    throw new Error('The zero-price resolution popover still shows a price')
  }

  await shoot(driver, 'resolution-popover-720')
}

async function imageResolutionLabels(context) {
  const { driver, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Image')
  await openImageModelPicker(driver)
  await waitPickerRow(driver, 'CU1', IMAGE_MODEL)
  await shoot(driver, `image-picker-description-${String(width)}`)
  await selectPickerRow(driver, 'CU1', IMAGE_MODEL)
  await waitBodyText(driver, IMAGE_CARD, WAIT_MS)

  const opened = await driver.evaluate(`(() => {
    const button = window.__e2e.bySelector('[aria-label^="Resolution:"]')
    if (!(button instanceof HTMLElement)) return false
    button.click()
    return true
  })()`)

  if (!opened) {
    throw new Error('No resolution trigger for the image model')
  }

  await driver.waitFor(
    `window.__e2e.exists('[data-radix-popper-content-wrapper]')`,
    WAIT_MS,
    'the image resolution popover',
  )
  await driver.waitFor(
    `(() => {
      const wrapper = document.querySelector('[data-radix-popper-content-wrapper]')
      const selected = wrapper === null ? null : wrapper.querySelector('[data-selected="true"]')
      if (!(selected instanceof HTMLElement)) return false
      return selected.innerText.includes('1K') && selected.innerText.includes('1024px')
    })()`,
    WAIT_MS,
    'the selected 1K resolution with its 1024px detail',
  )

  await shoot(driver, `image-resolution-popover-${String(width)}`)
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

async function firstImageId(server) {
  const deadline = Date.now() + WAIT_MS

  while (Date.now() < deadline) {
    const result = await server.api('/api/images')
    const [record] = result.items

    if (record !== undefined) {
      return record.id
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250)
    })
  }

  throw new Error('Timed out waiting for the custom image record')
}

async function customReferenceLabel(context) {
  const { driver, server, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-draft', 'unplatform-ai:image-view'])
  await gotoTab(driver, 'Image')
  await openImageModelPicker(driver)
  await waitPickerRow(driver, 'CU1', IMAGE_MODEL)
  await selectPickerRow(driver, 'CU1', IMAGE_MODEL)
  await waitBodyText(driver, IMAGE_CARD, WAIT_MS)

  await dropFile(driver, 'reference.png', 'image/png', PNG_1PX)
  await driver.waitFor(
    `document.querySelectorAll('[data-image-references] [aria-label^="Remove "]').length === 1`,
    WAIT_MS,
    'one image reference',
  )

  await setPrompt(driver, '@Image 1')
  await clickGenerate(driver)

  const id = await firstImageId(server)

  await waitRecord(
    server,
    '/api/images',
    id,
    (record) => {
      return record.status === 'completed' && record.outputs.length > 0
    },
    'completed image',
  )

  const result = await server.api('/api/dev/custom-mock/prompt')

  if (result.prompt !== '<image_1>') {
    throw new Error(`Custom prompt was ${JSON.stringify(result.prompt)}`)
  }

  await shoot(driver, `custom-reference-label-${String(width)}`)
}

async function customVideoReferenceLabels(context) {
  const { driver, server, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await selectPickerRow(driver, 'CU1', SCALE_MODEL)
  await waitBodyText(driver, SCALE_CARD, WAIT_MS)

  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    WAIT_MS,
    'the video references box',
  )

  await dropFile(driver, 'reference.png', 'image/png', PNG_1PX)
  await dropFile(driver, 'reference.aac', 'audio/aac', AAC_BASE64)

  await driver.waitFor(
    `window.__e2e.all('[data-references-box] [data-reference-kind="image"]').length === 1 && window.__e2e.all('[data-references-box] [data-reference-kind="audio"]').length === 1`,
    WAIT_MS,
    'one image and one audio reference',
  )

  await setPrompt(driver, '@Image 1 and @Audio 1')
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

  const result = await server.api('/api/dev/custom-mock/prompt?kind=video')

  if (result.prompt !== '<Picture 1> and <Audio 1>') {
    throw new Error(`Custom video prompt was ${JSON.stringify(result.prompt)}`)
  }

  await shoot(driver, `custom-video-reference-label-${String(width)}`)
}

async function customEndpointGenerate(context) {
  const { driver, server } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft', 'unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await openModelPicker(driver)
  await selectPickerRow(driver, 'CU1', MODEL_TITLE)
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

  const staleAlert = `[aria-label=${JSON.stringify(STALE_REASON)}]`

  const hasStaleAlert = await driver.evaluate(`(() => {
    const row = window.__e2e.all('button').find((node) => node.innerText.includes('CU2') && node.innerText.includes(${JSON.stringify(STALE_MODEL)}))
    if (row === undefined) return false
    row.scrollIntoView({ block: 'center' })
    return row.querySelector(${JSON.stringify(staleAlert)}) !== null
  })()`)

  if (!hasStaleAlert) {
    throw new Error('No stale alert icon in the CU2 row')
  }

  await driver.waitFor(
    `(() => {
      const rect = window.__e2e.rect(${JSON.stringify(staleAlert)})
      return rect !== null && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight
    })()`,
    WAIT_MS,
    'the stale alert icon in view',
  )

  await shoot(driver, `custom-picker-stale-${suffix}`)

  const alertRect = await driver.evaluate(`window.__e2e.rect(${JSON.stringify(staleAlert)})`)

  if (alertRect === null) {
    throw new Error('No stale alert icon rect')
  }

  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: alertRect.x + alertRect.width / 2,
    y: alertRect.y + alertRect.height / 2,
  })

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
  {
    name: 'custom-endpoint/image-resolution-labels',
    run: imageResolutionLabels,
  },
  {
    name: 'custom-endpoint/reference-label',
    run: customReferenceLabel,
    fresh: true,
  },
  {
    name: 'custom-endpoint/video-reference-label',
    run: customVideoReferenceLabels,
    fresh: true,
  },
]
