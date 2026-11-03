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
]
