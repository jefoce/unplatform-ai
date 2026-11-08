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
const AAC_BYTES = await fs.readFile(new URL('../../fixtures/media/sample.aac', import.meta.url))
const AAC_BASE64 = AAC_BYTES.toString('base64')
const AAC_NEXT_BASE64 = Buffer.concat([AAC_BYTES, Buffer.from([0, 0])]).toString('base64')
const MP4_BASE64 = (
  await fs.readFile(new URL('../../fixtures/media/sample.mp4', import.meta.url))
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

function centerOf(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

async function selectVideoPreset(driver, title) {
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
    15_000,
    'the model picker',
  )

  const selected = await driver.evaluate(`(() => {
    const row = window.__e2e.all('button').find((node) => node.innerText.trim().startsWith(${JSON.stringify(title)}))
    if (row === undefined) return false
    row.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No model row: ${title}`)
  }

  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    15_000,
    'the model picker to close',
  )
  await driver.waitFor(
    `document.body.innerText.includes(${JSON.stringify(title)})`,
    15_000,
    `the ${title} trigger`,
  )
}

/** Every reference tile with its id, kind and current box. */
async function referenceRects(driver) {
  return driver.evaluate(`(() => {
    return window.__e2e.all('[data-references-box] [data-reference-id]').map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        id: node.getAttribute('data-reference-id'),
        kind: node.getAttribute('data-reference-kind'),
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
      }
    })
  })()`)
}

function logSizes(label, rects) {
  console.log(`# ${label}`)

  for (const tile of rects) {
    console.log(
      `#   ${String(tile.kind).padEnd(5)} ${String(tile.id).slice(0, 8)} ${tile.width.toFixed(2)}x${tile.height.toFixed(2)}`,
    )
  }
}

function assertKeptSizes(before, during, skippedId) {
  const current = new Map(
    during.map((tile) => {
      return [tile.id, tile]
    }),
  )

  for (const tile of before) {
    if (tile.id === skippedId) {
      continue
    }

    const now = current.get(tile.id)

    if (now === undefined) {
      throw new Error(`Reference tile ${tile.id} vanished during the drag`)
    }

    if (Math.abs(now.width - tile.width) > 1 || Math.abs(now.height - tile.height) > 1) {
      throw new Error(
        `Reference tile ${tile.id} changed size while dragging: ${tile.width.toFixed(2)}x${tile.height.toFixed(2)} -> ${now.width.toFixed(2)}x${now.height.toFixed(2)}`,
      )
    }
  }
}

async function audioDragCase(context) {
  const { driver, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await selectVideoPreset(driver, 'Seedance 2.5')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )

  await dropFile(driver, 'drag-image-a.png', 'image/png', PNG_BASE64)
  await waitVideoRefs(driver, 1)
  await dropFile(driver, 'drag-image-b.jpg', 'image/jpeg', JPG_BASE64)
  await waitVideoRefs(driver, 2)
  await dropFile(driver, 'drag-video.mp4', 'video/mp4', MP4_BASE64)
  await waitVideoRefs(driver, 3)
  await dropFile(driver, 'drag-audio-a.aac', 'audio/aac', AAC_BASE64)
  await waitVideoRefs(driver, 4)
  await dropFile(driver, 'drag-audio-b.aac', 'audio/aac', AAC_NEXT_BASE64)
  await waitVideoRefs(driver, 5)
  await driver.waitFor(
    `window.__e2e.all('[data-references-box] [data-reference-kind="audio"]').length === 2`,
    15_000,
    'two audio reference tiles',
  )

  const before = await referenceRects(driver)
  const audio = before.filter((tile) => {
    return tile.kind === 'audio'
  })

  if (audio.length !== 2) {
    throw new Error(`Expected 2 audio tiles, got ${String(audio.length)}`)
  }

  const [firstAudio, secondAudio] = audio

  logSizes(`reference sizes before drag (width ${String(width)})`, before)
  console.log(
    `# screenshot ${await driver.captureScreenshot(`references-drag-before-${String(width)}`)}`,
  )

  const start = centerOf(firstAudio)
  const end = centerOf(secondAudio)

  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y })
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    clickCount: 1,
  })
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: start.x + 12,
    y: start.y,
    button: 'left',
    buttons: 1,
  })
  await driver.waitFor(
    `window.__e2e.exists('[data-reference-dragging="true"]')`,
    5_000,
    'the dragged tile marker',
  )
  await driver.waitFor(`window.__e2e.exists('[data-reference-overlay]')`, 5_000, 'the drag overlay')
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: end.x,
    y: end.y,
    button: 'left',
    buttons: 1,
  })

  const during = await referenceRects(driver)

  assertKeptSizes(before, during, firstAudio.id)

  const overlay = await driver.evaluate(`(() => {
    const node = document.querySelector('[data-reference-overlay]')
    if (node === null) return null
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })()`)

  if (overlay === null) {
    throw new Error('No drag overlay to measure')
  }

  logSizes(`reference sizes during drag (width ${String(width)})`, during)
  console.log(
    `# overlay ${overlay.width.toFixed(2)}x${overlay.height.toFixed(2)} audio ${firstAudio.width.toFixed(2)}x${firstAudio.height.toFixed(2)}`,
  )

  if (
    Math.abs(overlay.width - firstAudio.width) > 1 ||
    Math.abs(overlay.height - firstAudio.height) > 1
  ) {
    throw new Error(
      `Drag overlay is ${overlay.width.toFixed(2)}x${overlay.height.toFixed(2)}, audio tile is ${firstAudio.width.toFixed(2)}x${firstAudio.height.toFixed(2)}`,
    )
  }

  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: end.x,
    y: end.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await driver.waitFor(
    `!window.__e2e.exists('[data-reference-overlay]')`,
    10_000,
    'the drag overlay to close',
  )
  await driver.waitFor(
    `(() => {
      const tiles = window.__e2e.all('[data-references-box] [data-reference-kind="audio"]')
      return tiles.length === 2 && tiles[0].getAttribute('data-reference-id') === ${JSON.stringify(secondAudio.id)}
    })()`,
    10_000,
    'audio 2 before audio 1',
  )

  const after = await referenceRects(driver)
  const afterAudio = after.filter((tile) => {
    return tile.kind === 'audio'
  })

  if (afterAudio[0]?.id !== secondAudio.id || afterAudio[1]?.id !== firstAudio.id) {
    throw new Error(`Audio order after drag is ${afterAudio.map((tile) => tile.id).join(', ')}`)
  }

  const beforeOthers = before.filter((tile) => {
    return tile.kind !== 'audio'
  })
  const afterOthers = after.filter((tile) => {
    return tile.kind !== 'audio'
  })

  if (
    JSON.stringify(beforeOthers.map((tile) => tile.id)) !==
    JSON.stringify(afterOthers.map((tile) => tile.id))
  ) {
    throw new Error('Image or video order changed after the audio drag')
  }

  logSizes(`reference sizes after drag (width ${String(width)})`, after)
  console.log(
    `# screenshot ${await driver.captureScreenshot(`references-drag-after-${String(width)}`)}`,
  )
}

async function audioDragSingleCase(context) {
  const { driver, width } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await selectVideoPreset(driver, 'Seedance 2.5')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )

  await dropFile(driver, 'drag-single-audio.aac', 'audio/aac', AAC_BASE64)
  await waitVideoRefs(driver, 1)
  await driver.waitFor(
    `window.__e2e.all('[data-references-box] [data-reference-kind="audio"]').length === 1`,
    15_000,
    'one audio reference tile',
  )

  const before = await referenceRects(driver)
  const audio = before.filter((tile) => {
    return tile.kind === 'audio'
  })

  if (audio.length !== 1) {
    throw new Error(`Expected 1 audio tile, got ${String(audio.length)}`)
  }

  const [tile] = audio
  const start = centerOf(tile)

  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y })
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    clickCount: 1,
  })
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: start.x + 12,
    y: start.y,
    button: 'left',
    buttons: 1,
  })
  await driver.waitFor(
    `window.__e2e.exists('[data-reference-dragging="true"]')`,
    5_000,
    'the dragged tile marker',
  )
  await driver.waitFor(`window.__e2e.exists('[data-reference-overlay]')`, 5_000, 'the drag overlay')

  const overlay = await driver.evaluate(`(() => {
    const node = document.querySelector('[data-reference-overlay]')
    if (node === null) return null
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })()`)

  if (overlay === null) {
    throw new Error('No drag overlay to measure')
  }

  if (Math.abs(overlay.width - tile.width) > 1 || Math.abs(overlay.height - tile.height) > 1) {
    throw new Error(
      `Drag overlay is ${overlay.width.toFixed(2)}x${overlay.height.toFixed(2)}, audio tile is ${tile.width.toFixed(2)}x${tile.height.toFixed(2)}`,
    )
  }

  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: start.x + 12,
    y: start.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await driver.waitFor(
    `!window.__e2e.exists('[data-reference-overlay]')`,
    10_000,
    'the drag overlay to close',
  )
  await driver.waitFor(
    `(() => {
      const tiles = window.__e2e.all('[data-references-box] [data-reference-kind="audio"]')
      return tiles.length === 1 && tiles[0].getAttribute('data-reference-id') === ${JSON.stringify(tile.id)}
    })()`,
    10_000,
    'the audio tile to keep its id',
  )

  const after = await referenceRects(driver)
  const afterAudio = after.filter((item) => {
    return item.kind === 'audio'
  })

  if (afterAudio.length !== 1 || afterAudio[0]?.id !== tile.id) {
    throw new Error(`Audio order after drag is ${afterAudio.map((item) => item.id).join(', ')}`)
  }

  console.log(
    `# screenshot ${await driver.captureScreenshot(`references-audio-single-${String(width)}`)}`,
  )
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
  {
    name: 'references/audio-drag-sizes',
    run: audioDragCase,
  },
  {
    name: 'references/audio-drag-single',
    run: audioDragSingleCase,
  },
]
