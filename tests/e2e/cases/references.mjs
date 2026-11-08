import fs from 'node:fs/promises'

import {
  dropFile,
  gotoTab,
  openApp,
  openImagePicker,
  pickerTab,
  resetLocal,
  setView,
  tileClick,
  waitPicker,
} from '../lib/dom.mjs'
import { seedVideo } from '../lib/server.mjs'

const PNG_BASE64 = (
  await fs.readFile(new URL('../../fixtures/media/sample.png', import.meta.url))
).toString('base64')
const JPG_BASE64 = (
  await fs.readFile(new URL('../../fixtures/media/sample.jpg', import.meta.url))
).toString('base64')

async function waitImageRefs(driver, expected) {
  await driver.waitFor(
    `document.querySelectorAll('[data-image-references] [aria-label^="Remove "]').length === ${String(expected)}`,
    30_000,
    `image references = ${String(expected)}`,
  )
}

async function waitVideoRefs(driver, expected) {
  await driver.waitFor(
    `document.querySelectorAll('[data-references-box] [aria-label^="Remove "]').length === ${String(expected)}`,
    30_000,
    `video references = ${String(expected)}`,
  )
}

const PICKER_CLOSE = '[aria-label="Close picker"]'
const PREVIEW_CLOSE = '[aria-label="Close"]'

const PICKER_SCROLL_EXPRESSION = `(() => {
  const close = document.querySelector('${PICKER_CLOSE}')
  const dialog = close === null ? null : close.closest('[role="dialog"]')
  if (dialog === null) return null
  return [...dialog.querySelectorAll('*')].find((node) => {
    return node.scrollHeight > node.clientHeight + 4 && getComputedStyle(node).overflowY === 'auto'
  }) ?? null
})()`

/** Seeds enough uploads to make the picker scroll. */
async function seedScrollUploads(server) {
  const base = Buffer.from(PNG_BASE64, 'base64')

  for (let start = 0; start < 40; start += 20) {
    const form = new FormData()
    const batch = Math.min(20, 40 - start)

    for (let index = 0; index < batch; index += 1) {
      const fileIndex = start + index
      const bytes = Buffer.concat([base, Buffer.alloc(fileIndex + 1, 0x20)])
      const name = `scroll-${String(fileIndex)}.png`
      form.append('file', new Blob([bytes], { type: 'image/png' }), name)
    }

    const response = await fetch(`${server.baseUrl}/api/uploads`, {
      method: 'POST',
      headers: { cookie: `upai_session=${server.token}` },
      body: form,
    })

    if (!response.ok) {
      throw new Error(`Upload seed failed: ${String(response.status)}`)
    }
  }
}

async function setPickerScroll(driver, top) {
  return driver.evaluate(`(() => {
    const scroll = ${PICKER_SCROLL_EXPRESSION}
    if (scroll === null) return null
    scroll.scrollTop = Math.min(${String(top)}, scroll.scrollHeight - scroll.clientHeight)
    return scroll.scrollTop
  })()`)
}

async function pickerScrollTop(driver) {
  return driver.evaluate(`(() => {
    const scroll = ${PICKER_SCROLL_EXPRESSION}
    return scroll === null ? null : scroll.scrollTop
  })()`)
}

async function assertPickerScroll(driver, expected) {
  const actual = await pickerScrollTop(driver)

  if (actual !== expected) {
    throw new Error(`Picker scroll is ${String(actual)}, expected ${String(expected)}`)
  }
}

/** Opens the first upload preview from inside the picker. */
async function openPickerPreview(driver) {
  const opened = await driver.evaluate(`(() => {
    const close = document.querySelector('${PICKER_CLOSE}')
    const dialog = close === null ? null : close.closest('[role="dialog"]')
    const tile = dialog === null ? null : dialog.querySelector('[aria-label^="Preview "]')
    if (tile === null) return false
    tile.click()
    return true
  })()`)

  if (!opened) {
    throw new Error('No previewable picker tile')
  }

  await driver.waitFor(`window.__e2e.exists('${PREVIEW_CLOSE}')`, 15_000, 'the media preview')
  await driver.waitFor(
    `(() => {
      const close = document.querySelector('${PREVIEW_CLOSE}')
      const dialog = close === null ? null : close.closest('[role="dialog"]')
      return dialog !== null && dialog.contains(document.activeElement)
    })()`,
    10_000,
    'the preview focus',
  )
}

async function closePreview(driver) {
  await driver.evaluate(`document.querySelector('${PREVIEW_CLOSE}').click()`)
  await driver.waitFor(`!window.__e2e.exists('${PREVIEW_CLOSE}')`, 15_000, 'the preview to close')
}

/** Real pointer click on a nav control that only reveals on stage hover. */
async function clickPreviewNav(driver, label) {
  const selector = `[aria-label="${label}"]`

  await driver.hover(selector)
  await driver.waitFor(
    `getComputedStyle(document.querySelector('${selector}')).pointerEvents !== 'none'`,
    10_000,
    `the ${label} control`,
  )
  await driver.mouseClick(selector)
}

/** Picker scroll survives a preview, its arrows and Escape. */
async function pickerPreviewChecks(driver) {
  await driver.waitFor(
    `window.__e2e.exists('[aria-label^="Preview "]')`,
    20_000,
    'a previewable upload',
  )
  await driver.waitFor(`Boolean(${PICKER_SCROLL_EXPRESSION})`, 20_000, 'a scrollable picker')

  const startTop = await setPickerScroll(driver, 120)

  if (startTop === null || startTop <= 0) {
    throw new Error(`Picker did not scroll: ${String(startTop)}`)
  }

  await openPickerPreview(driver)
  await clickPreviewNav(driver, 'Next')
  await clickPreviewNav(driver, 'Previous')
  await closePreview(driver)
  await waitPicker(driver)
  await assertPickerScroll(driver, startTop)

  await openPickerPreview(driver)
  await driver.pressKey('Escape')
  await driver.waitFor(
    `!window.__e2e.exists('${PREVIEW_CLOSE}')`,
    15_000,
    'Escape to close the preview',
  )
  await waitPicker(driver)
  await assertPickerScroll(driver, startTop)
}

async function imagePickerPreviewCase(context) {
  const { driver, server } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-draft', 'unplatform-ai:image-view'])
  await gotoTab(driver, 'Image')
  await seedScrollUploads(server)
  await openImagePicker(driver)
  await pickerPreviewChecks(driver)

  await dropFile(driver, 'picker-remove.png', 'image/png', PNG_BASE64)
  await waitImageRefs(driver, 1)
  await driver.evaluate(
    `document.querySelector('[data-image-references] [aria-label^="Remove "]').click()`,
  )
  await waitImageRefs(driver, 0)
  await waitPicker(driver)
}

async function videoPickerPreviewCase(context) {
  const { driver, server } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )

  await dropFile(driver, 'video-picker-remove.png', 'image/png', PNG_BASE64)
  await waitVideoRefs(driver, 1)

  await seedScrollUploads(server)
  await driver.clickLabel('Add references')
  await waitPicker(driver)
  await pickerPreviewChecks(driver)

  await driver.evaluate(
    `document.querySelector('[data-references-box] [aria-label^="Remove "]').click()`,
  )
  await waitVideoRefs(driver, 0)
  await waitPicker(driver)
}

async function referencesRouting(context) {
  const { driver, fixture } = context

  await fixture('refPickerImage')
  const cardImage = await fixture('refCardImage')
  const viewerImage = await fixture('refViewerImage')
  await fixture('savedVideo')

  await openApp(context)
  await resetLocal(driver, [
    'unplatform-ai:image-draft',
    'unplatform-ai:draft',
    'unplatform-ai:image-view',
  ])
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')

  await openImagePicker(driver)
  await pickerTab(driver, 'Generations')
  await driver.waitFor(
    `window.__e2e.all('[aria-label^="Use "]').length > 0`,
    20_000,
    'a generation tile',
  )
  await driver.evaluate(`document.querySelector('[aria-label^="Use "]').click()`)
  await waitImageRefs(driver, 1)
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    10_000,
    'the picker after picking',
  )

  await driver.evaluate(
    `document.querySelector('[data-image-references] [aria-label^="Remove "]').click()`,
  )
  await waitImageRefs(driver, 0)
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    10_000,
    'the picker after removal',
  )
  await driver.clickLabel('Close picker')

  await driver.waitFor(
    `window.__e2e.exists('#history-item-${cardImage.outputs[0].id}')`,
    15_000,
    'the card reference tile',
  )
  await driver.evaluate(
    `document.querySelector('#history-item-${cardImage.outputs[0].id} [aria-label="Reference"]').click()`,
  )
  await waitImageRefs(driver, 1)

  await driver.evaluate(
    `document.querySelector('#history-item-${viewerImage.outputs[0].id} [role="button"]').click()`,
  )
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the image viewer')
  await driver.waitFor(
    `window.__e2e.all('[data-slot="toolbar"] button').length === 1`,
    10_000,
    'the viewer reference button',
  )
  await driver.evaluate(`document.querySelector('[data-slot="toolbar"] button').click()`)
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer to close')
  await waitImageRefs(driver, 2)

  await dropFile(driver, 'drop.png', 'image/png', PNG_BASE64)
  await waitImageRefs(driver, 3)
  await dropFile(driver, 'paste.jpg', 'image/jpeg', JPG_BASE64, true)
  await waitImageRefs(driver, 4)

  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )
  await dropFile(driver, 'video-ref.png', 'image/png', PNG_BASE64)
  await waitVideoRefs(driver, 1)

  await setView(driver, 'Grid')
  await tileClick(driver, 'Open video details')
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the video viewer')
  const label = await driver.evaluate(
    `document.querySelector('[data-slot="toolbar"] button')?.innerText.trim() ?? ''`,
  )

  if (label !== 'Reference') {
    throw new Error(`Video reference viewer shows ${label}`)
  }

  await driver.clickLabel('Close')
}

async function videoPasteAndGenerationPicker(context) {
  const { driver, fixture } = context

  await fixture('savedVideo')
  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )

  await dropFile(driver, 'video-paste.png', 'image/png', PNG_BASE64, true)
  await waitVideoRefs(driver, 1)

  await driver.clickLabel('Add references')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    15_000,
    'the video reference picker',
  )
  await pickerTab(driver, 'Video generations')
  await driver.waitFor(
    `window.__e2e.all('[aria-label^="Use "]').length > 0`,
    20_000,
    'a video generation tile',
  )
  await driver.evaluate(`document.querySelector('[aria-label^="Use "]').click()`)
  await waitVideoRefs(driver, 2)
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    10_000,
    'the picker after picking a video',
  )
  await driver.clickLabel('Close picker')
}

async function videoCardAndViewerReference(context) {
  const { driver, server, fixture } = context
  const suffix = String(Date.now())
  const viewerVideo = seedVideo(server, `e2e viewer reference ${suffix}`, { resolution: '720p' })
  const cardVideo = await fixture('savedVideo')
  const viewer = await viewerVideo

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.exists('#history-item-${cardVideo.id}')`,
    30_000,
    'the card video tile',
  )

  await driver.mouseClick(`#history-item-${cardVideo.id} [aria-label="More actions"]`)
  await driver.waitFor(
    `window.__e2e.all('[role="menuitem"]').some((node) => node.innerText.includes('Add video as reference'))`,
    10_000,
    'the video reference menu item',
  )
  await driver.clickText('Add video as reference')
  await waitVideoRefs(driver, 1)

  await driver.evaluate(
    `document.querySelector('#history-item-${viewer.id} [role="button"]').click()`,
  )
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the video viewer')
  await driver.waitFor(
    `window.__e2e.exists('[data-slot="toolbar"] button')`,
    10_000,
    'the viewer reference button',
  )
  await driver.evaluate(`document.querySelector('[data-slot="toolbar"] button').click()`)
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer to close')
  await waitVideoRefs(driver, 2)
}

export const referenceCases = [
  {
    name: 'references/viewer-card-picker-drop-paste',
    run: referencesRouting,
  },
  {
    name: 'references/video-paste-generation-picker',
    run: videoPasteAndGenerationPicker,
  },
  {
    name: 'references/video-card-viewer',
    run: videoCardAndViewerReference,
  },
  {
    name: 'references/picker-preview-image',
    run: imagePickerPreviewCase,
  },
  {
    name: 'references/picker-preview-video',
    run: videoPickerPreviewCase,
  },
]
