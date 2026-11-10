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

function parseTransform(value) {
  const match = /^translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0(?:px)?\) scale\((-?[\d.]+)\)$/.exec(
    value,
  )

  if (match === null) {
    throw new Error(`Unexpected transform: ${value}`)
  }

  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) }
}

async function zoomedContent(driver) {
  return driver.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const image = [...dialog.querySelectorAll('img')].find((node) => node.getAttribute('aria-hidden') !== 'true')
    if (image === undefined) return null
    const content = image.parentElement?.parentElement?.parentElement
    if (content === undefined || content === null) return null
    const layer = content.parentElement
    if (layer === null) return null
    const rect = layer.getBoundingClientRect()
    return {
      transform: content.style.transform,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }
  })()`)
}

async function dragBy(driver, start, deltaX, deltaY, steps) {
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: start.x,
    y: start.y,
  })
  await driver.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })

  for (let step = 1; step <= steps; step += 1) {
    await driver.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + (deltaX * step) / steps,
      y: start.y + (deltaY * step) / steps,
      button: 'left',
      buttons: 1,
    })
  }

  await driver.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: start.x + deltaX,
    y: start.y + deltaY,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
}

async function zoomedPan(context) {
  const { driver } = context

  await context.fixture('savedImage')
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await openFirstTile(driver, 'Open image details')
  await driver.waitFor(
    `[...document.querySelectorAll('[role="dialog"] img')].some((node) => node.getAttribute('aria-hidden') !== 'true' && node.complete && node.naturalWidth > 0)`,
    20_000,
    'the viewer image',
  )

  await driver.evaluate(`(() => {
    const button = document.querySelector('[aria-label="Zoom in"]')
    for (let index = 0; index < 5; index += 1) button.click()
  })()`)
  await driver.waitFor(
    `(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const image = [...dialog.querySelectorAll('img')].find((node) => node.getAttribute('aria-hidden') !== 'true')
      const content = image?.parentElement?.parentElement?.parentElement
      const match = /scale\\(([\\d.]+)\\)/.exec(content?.style.transform ?? '')
      return match !== null && Number(match[1]) > 7
    })()`,
    10_000,
    'the zoomed content',
  )

  await driver.evaluate('window.__zoomRenders = 0')

  const before = await zoomedContent(driver)

  if (before === null) {
    throw new Error('No zoomed content')
  }

  const start = {
    x: before.rect.x + before.rect.width / 2,
    y: before.rect.y + before.rect.height / 2,
  }

  await dragBy(driver, start, 60, 40, 10)
  await driver.waitFor(
    `(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const image = [...dialog.querySelectorAll('img')].find((node) => node.getAttribute('aria-hidden') !== 'true')
      return image?.parentElement?.parentElement?.parentElement?.style.transform !== ${JSON.stringify(before.transform)}
    })()`,
    5_000,
    'the panned transform',
  )

  const after = await zoomedContent(driver)

  if (after === null) {
    throw new Error('No zoomed content after the drag')
  }

  const startOffset = parseTransform(before.transform)
  const endOffset = parseTransform(after.transform)
  const driftX = Math.abs(endOffset.x - (startOffset.x + 60))
  const driftY = Math.abs(endOffset.y - (startOffset.y + 40))

  if (driftX > 1 || driftY > 1) {
    throw new Error(`Panned to ${String(endOffset.x)},${String(endOffset.y)} instead of +60,+40`)
  }

  const renders = await driver.evaluate('window.__zoomRenders')

  if (renders > 2) {
    throw new Error(`ZoomLayer rendered ${String(renders)} times during the drag`)
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

async function previewNoThumbFirstPaint(context) {
  const { driver } = context

  await context.fixture('savedImage')
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.all('[aria-label="Open image details"]').length > 0`,
    30_000,
    'an image tile',
  )

  const hasThumb = await driver.evaluate(`new Promise((resolve) => {
    const tile = window.__e2e.all('[aria-label="Open image details"]')[0]
    tile.click()
    const check = () => {
      const stage = document.querySelector('[role="dialog"] [style*="aspect-ratio"]')
      if (stage === null) {
        requestAnimationFrame(check)
        return
      }
      const thumb = [...stage.querySelectorAll('img')].find((img) => (img.getAttribute('src') ?? '').includes('/api/thumbs'))
      resolve(thumb !== undefined)
    }
    requestAnimationFrame(check)
  })`)

  if (hasThumb) {
    throw new Error('Viewer stage painted a thumbnail on the first frame')
  }

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
  {
    name: 'viewer/zoomed-pan',
    run: zoomedPan,
  },
  {
    name: 'viewer/preview-no-thumb-first-paint',
    run: previewNoThumbFirstPaint,
  },
]
