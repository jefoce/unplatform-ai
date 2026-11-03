import { gotoTab, openApp, setView, tileClick } from '../lib/dom.mjs'
import { seedImage } from '../lib/server.mjs'

async function openFirstTile(driver, label) {
  await tileClick(driver, label)
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer')
}

async function toolbarButtons(driver) {
  return driver.evaluate(
    `window.__e2e.all('[data-slot="toolbar"] button').map((node) => node.innerText.trim())`,
  )
}

async function closeViewer(driver) {
  await driver.clickLabel('Close')
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer to close')
}

async function imageRoundedRect(driver) {
  return driver.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const image = [...dialog.querySelectorAll('img')].find((node) => node.getAttribute('aria-hidden') !== 'true')
    if (image === undefined) return null
    const box = image.parentElement?.parentElement
    if (box === undefined || box === null) return null
    const imageRect = image.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    return {
      image: { x: imageRect.x, y: imageRect.y, width: imageRect.width, height: imageRect.height },
      box: { x: boxRect.x, y: boxRect.y, width: boxRect.width, height: boxRect.height },
      radius: Number.parseFloat(getComputedStyle(box).borderRadius),
    }
  })()`)
}

async function viewerUseButtonAndRoundedMedia(context) {
  const { driver, fixture } = context

  await fixture('savedImage')
  await fixture('savedVideo')
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await openFirstTile(driver, 'Open image details')

  const imageButtons = await toolbarButtons(driver)

  if (imageButtons.length !== 1) {
    throw new Error(
      `Image viewer has ${String(imageButtons.length)} use buttons: ${imageButtons.join(', ')}`,
    )
  }

  await driver.waitFor(
    `[...document.querySelectorAll('[role="dialog"] img')].some((node) => node.getAttribute('aria-hidden') !== 'true' && node.complete && node.naturalWidth > 0)`,
    20_000,
    'the viewer image to load',
  )
  const rects = await imageRoundedRect(driver)

  if (rects === null) {
    throw new Error('No image box in the viewer')
  }

  const delta = Math.max(
    Math.abs(rects.image.x - rects.box.x),
    Math.abs(rects.image.y - rects.box.y),
    Math.abs(rects.image.width - rects.box.width),
    Math.abs(rects.image.height - rects.box.height),
  )

  if (delta > 1) {
    throw new Error(`Image and media box rects differ by ${String(delta)} px`)
  }

  if (!(rects.radius > 0)) {
    throw new Error('Viewer media box has no rounded corners')
  }

  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Previous"]') && window.__e2e.exists('[aria-label="Next"]')`,
    10_000,
    'the viewer arrows',
  )
  const nextDisabled = await driver.evaluate(
    `document.querySelector('[aria-label="Next"]').disabled`,
  )

  if (!nextDisabled) {
    await driver.clickLabel('Next')
    await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 10_000, 'the next item')
  }

  await closeViewer(driver)

  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')
  await openFirstTile(driver, 'Open video details')
  const videoButtons = await toolbarButtons(driver)

  if (videoButtons.length !== 1) {
    throw new Error(
      `Video viewer has ${String(videoButtons.length)} use buttons: ${videoButtons.join(', ')}`,
    )
  }

  await closeViewer(driver)
}

async function dialogText(driver) {
  return driver.evaluate(`document.querySelector('[role="dialog"]').innerText`)
}

async function previousArrow(context) {
  const { driver, server } = context
  const suffix = String(Date.now())

  const first = await seedImage(server, `e2e previous first ${suffix}`)
  const second = await seedImage(server, `e2e previous second ${suffix}`)

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.all('[aria-label="Open image details"]').length >= 2`,
    20_000,
    'two image tiles',
  )
  await tileClick(driver, 'Open image details', 1)
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer')

  const before = await dialogText(driver)
  const wanted = before.includes(first.input.prompt) ? second.input.prompt : first.input.prompt

  await driver.evaluate(`document.querySelector('[aria-label="Previous"]').click()`)
  await driver.waitFor(
    `document.querySelector('[role="dialog"]').innerText !== ${JSON.stringify(before)}`,
    10_000,
    'the previous item',
  )

  const after = await dialogText(driver)

  if (!after.includes(wanted)) {
    throw new Error('Previous arrow did not move to the older item')
  }

  const isPreviousDisabled = await driver.evaluate(
    `document.querySelector('[aria-label="Previous"]').disabled`,
  )

  if (!isPreviousDisabled) {
    throw new Error('Previous arrow stays enabled on the first item')
  }

  await driver.clickLabel('Next')
  await driver.waitFor(
    `document.querySelector('[role="dialog"]').innerText === ${JSON.stringify(before)}`,
    10_000,
    'the next item',
  )
  await closeViewer(driver)
}

export const viewerCases = [
  {
    name: 'viewer/one-use-button-rounded-media',
    run: viewerUseButtonAndRoundedMedia,
  },
  {
    name: 'viewer/previous-arrow',
    run: previousArrow,
  },
]
