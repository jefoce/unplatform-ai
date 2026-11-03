import { gotoTab, openApp, openImagePicker, pickerTab, resetLocal } from '../lib/dom.mjs'
import { seedImage } from '../lib/server.mjs'

function near(actual, expected, tolerance = 0.5) {
  return Math.abs(actual - expected) <= tolerance
}

async function rectOf(driver, selector) {
  return driver.evaluate(`window.__e2e.rect(${JSON.stringify(selector)})`)
}

async function selectImagePreset(driver, title) {
  await driver.click('[data-image-prompt-bar] [data-model-chip]')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Search models"]')`,
    10_000,
    'the image model picker',
  )

  const selected = await driver.evaluate(`(() => {
    const row = window.__e2e.all('button[aria-pressed]').find((node) => {
      return node.innerText.trim().startsWith(${JSON.stringify(title)})
    })
    if (row === undefined) return false
    row.click()
    return true
  })()`)

  if (!selected) {
    throw new Error(`No image model row: ${title}`)
  }

  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Search models"]')`,
    10_000,
    'the image model picker to close',
  )
  await driver.waitFor(
    `window.__e2e.all('[data-image-controls] button').some((node) => node.innerText.trim() === 'Random')`,
    10_000,
    'the Random seed control',
  )
}

async function setMasonryView(driver, params) {
  const { zoom, filters = {}, minTiles } = params
  const state = { view: 'masonry', zoom, filters }

  await driver.evaluate(
    `localStorage.setItem('unplatform-ai:image-view', ${JSON.stringify(JSON.stringify({ state, version: 1 }))})`,
  )
  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app after view reset',
  )
  await driver.waitFor(
    `window.__e2e.all('[id^="history-item-"]').length >= ${String(minTiles)}`,
    30_000,
    `at least ${String(minTiles)} masonry tiles`,
  )
}

async function measureMasonry(driver) {
  return driver.evaluate(`(() => {
    const scroll = [...document.querySelectorAll('div')].find((node) => {
      return getComputedStyle(node).overflowY === 'auto' && node.querySelector('[id^="history-item-"]') !== null
    })
    if (scroll === undefined) return null
    const scrollbar = scroll.offsetWidth - scroll.clientWidth
    const rows = new Map()
    for (const wrapper of scroll.querySelectorAll('[id^="history-item-"]')) {
      const rect = wrapper.getBoundingClientRect()
      const top = Math.round(rect.top)
      const row = rows.get(top) ?? []
      row.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        height: rect.height,
        width: rect.width,
      })
      rows.set(top, row)
    }
    return {
      scrollbar,
      windowWidth: window.innerWidth,
      rows: [...rows.values()].sort((a, b) => a[0].top - b[0].top),
    }
  })()`)
}

async function layoutMetrics(context) {
  const { driver, fixture } = context

  await fixture('layoutSquare')
  await fixture('layoutWide')
  await fixture('layoutTall')
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setMasonryView(driver, { zoom: 5, minTiles: 3 })
  const masonry = await measureMasonry(driver)

  if (masonry === null) {
    throw new Error('No masonry scroll container')
  }

  const fullRows = masonry.rows.filter((row) => {
    return row.length >= 3
  })

  if (fullRows.length === 0) {
    throw new Error('No full masonry row to measure')
  }

  const expectedRight = masonry.windowWidth - 4 - masonry.scrollbar

  for (const row of fullRows) {
    const last = row.at(-1)

    if (!near(last.right, expectedRight, 1)) {
      throw new Error(
        `Full row right edge ${String(last.right)} != ${String(expectedRight)} (scrollbar ${String(masonry.scrollbar)})`,
      )
    }
  }

  const imageIsland = await rectOf(driver, '[data-island]')
  const imageSurface = await rectOf(driver, '[data-island] > div:first-child')

  if (imageIsland === null || imageSurface === null) {
    throw new Error('No image island')
  }

  await gotoTab(driver, 'Video')
  const aside = await rectOf(driver, 'main > aside')
  const section = await rectOf(driver, 'main > section')

  if (aside === null || section === null) {
    throw new Error('No video aside or section')
  }

  await gotoTab(driver, 'Image')
  const imageIslandAgain = await rectOf(driver, '[data-island]')

  if (imageIslandAgain === null) {
    throw new Error('No image island after switching back')
  }

  if (
    !near(imageIslandAgain.x, imageIsland.x) ||
    !near(imageIslandAgain.width, imageIsland.width)
  ) {
    throw new Error('Island moved after switching tabs')
  }

  await gotoTab(driver, 'Video')
  const asideAgain = await rectOf(driver, 'main > aside')
  const sectionAgain = await rectOf(driver, 'main > section')

  if (asideAgain === null || sectionAgain === null) {
    throw new Error('No video geometry after switching back')
  }

  if (
    !near(imageSurface.x, asideAgain.x) ||
    !near(imageSurface.width, asideAgain.width) ||
    !near(imageIsland.right, sectionAgain.right) ||
    !near(imageIsland.top, 8)
  ) {
    throw new Error(
      `Island ${JSON.stringify(imageSurface)} ${JSON.stringify(imageIsland)} video ${JSON.stringify(asideAgain)} ${JSON.stringify(sectionAgain)}`,
    )
  }

  await gotoTab(driver, 'Image')
  const opacity = async () => {
    return driver.evaluate(
      `Number(getComputedStyle(document.querySelector('[data-island]')).opacity)`,
    )
  }

  if ((await opacity()) < 0.9) {
    throw new Error('Island does not rest opaque')
  }

  await driver.hover('[data-island]')
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector('[data-island]')).opacity) > 0.9`,
    10_000,
    'the island hover opacity',
  )
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector('[data-island]')).opacity) > 0.9`,
    10_000,
    'the island rest opacity',
  )

  await driver.clickText('Filter')
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector('[data-island]')).opacity) > 0.9`,
    10_000,
    'the island opacity with the filter open',
  )
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector('[data-island]')).opacity) > 0.9`,
    10_000,
    'the island staying opaque with the filter open',
  )
  await driver.pressKey('Escape')
}

async function clearButtonPlacement(context) {
  const { driver } = context

  await openApp(context)
  await gotoTab(driver, 'Image')

  const addReference = await rectOf(driver, '[data-image-prompt-bar] [data-add-reference]')
  const imageClear = await rectOf(driver, '[data-image-prompt-bar] [data-clear-draft]')
  const modelChip = await rectOf(driver, '[data-image-prompt-bar] [data-model-chip]')

  if (addReference === null || imageClear === null || modelChip === null) {
    throw new Error('No image clear, add-reference or model control')
  }

  if (imageClear.left < addReference.right) {
    throw new Error(
      `Image clear starts before add-reference: ${imageClear.left} < ${addReference.right}`,
    )
  }

  if (imageClear.right > modelChip.left) {
    throw new Error(
      `Image clear ends after the model chip: ${imageClear.right} > ${modelChip.left}`,
    )
  }

  await gotoTab(driver, 'Video')

  const footer = await rectOf(driver, '[data-prompt-footer]')
  const videoClear = await rectOf(driver, '[data-prompt-footer] [data-clear-draft]')

  if (footer === null || videoClear === null) {
    throw new Error('No video prompt footer or clear button')
  }

  if (!near(videoClear.right, footer.right - 12, 1)) {
    throw new Error(`Video clear right ${videoClear.right} != footer right ${footer.right - 12}`)
  }

  if (videoClear.top < footer.top || videoClear.bottom > footer.bottom) {
    throw new Error('Video clear is outside the prompt row')
  }
}

async function imageBarControls(context) {
  const { driver, width } = context

  await openApp(context)
  await gotoTab(driver, 'Image')
  await selectImagePreset(driver, 'Seedream 5 Flash')

  const controls = await driver.evaluate(`(() => {
    const row = document.querySelector('[data-image-controls]')
    if (row === null) return null
    return [...row.children]
      .filter((node) => node.tagName !== 'SPAN')
      .map((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return {
          name: node.getAttribute('aria-label') ?? node.textContent.trim().slice(0, 24),
          height: rect.height,
          center: rect.top + rect.height / 2,
          background: style.backgroundColor,
          fontSize: style.fontSize,
        }
      })
  })()`)

  if (controls === null || controls.length !== 7) {
    throw new Error(`Image bar has ${String(controls?.length)} controls`)
  }

  const [first] = controls
  const names = controls.map((control) => {
    return control.name
  })
  const expected = ['Add references', 'Clear prompt and inputs', 'Seedream 5 Flash', 'Random']
  const prefixes = ['Aspect', 'Resolution']

  for (const label of expected) {
    if (!names.includes(label)) {
      throw new Error(`Image bar is missing ${label}: ${names.join(', ')}`)
    }
  }

  for (const prefix of prefixes) {
    if (!names.some((name) => name.startsWith(prefix))) {
      throw new Error(`Image bar is missing ${prefix}: ${names.join(', ')}`)
    }
  }

  console.log(
    `image bar ${String(width)}: ${controls
      .map((control) => {
        return `${control.name} h=${String(control.height)} bg=${control.background} font=${control.fontSize} center=${String(control.center)}`
      })
      .join(' | ')}`,
  )

  for (const control of controls) {
    if (!near(control.height, 32, 1)) {
      throw new Error(`Image bar control ${control.name} height ${String(control.height)} != 32`)
    }

    if (!near(control.center, first.center, 0.5)) {
      throw new Error(`Image bar control ${control.name} is not centered with the row`)
    }

    if (control.background !== first.background) {
      throw new Error(
        `Image bar control ${control.name} background ${control.background} != ${first.background}`,
      )
    }

    if (control.fontSize !== first.fontSize) {
      throw new Error(
        `Image bar control ${control.name} font size ${control.fontSize} != ${first.fontSize}`,
      )
    }
  }
}

async function setFeedScroll(driver, scrollTop) {
  const moved = await driver.evaluate(`(() => {
    const scroll = [...document.querySelectorAll('div')].find((node) => {
      return getComputedStyle(node).overflowY === 'auto' && node.querySelector('[id^="history-item-"]') !== null
    })
    if (scroll === undefined) return false
    scroll.scrollTop = ${String(scrollTop)}
    return true
  })()`)

  if (!moved) {
    throw new Error('No image feed scroll container')
  }
}

async function feedMetrics(driver) {
  return driver.evaluate(`(() => {
    const island = document.querySelector('[data-island]')
    const tiles = window.__e2e.all('[id^="history-item-"]')
    const scroll = [...document.querySelectorAll('div')].find((node) => {
      return getComputedStyle(node).overflowY === 'auto' && node.querySelector('[id^="history-item-"]') !== null
    })
    if (island === null || tiles.length === 0 || scroll === undefined) return null
    return {
      dataScrolled: island.getAttribute('data-scrolled'),
      opacity: Number(getComputedStyle(island).opacity),
      islandBottom: island.getBoundingClientRect().bottom,
      firstTop: Math.min(...tiles.map((node) => node.getBoundingClientRect().top)),
      scrollTop: scroll.scrollTop,
    }
  })()`)
}

async function imageTopBar(context) {
  const { driver, server } = context
  const suffix = String(Date.now())

  await seedImage(server, `e2e top bar a ${suffix}`, {
    count: 4,
    aspectRatio: '9:16',
    resolution: '1K',
  })
  await seedImage(server, `e2e top bar b ${suffix}`, {
    count: 4,
    aspectRatio: '9:16',
    resolution: '1K',
  })

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-view'])
  await gotoTab(driver, 'Image')
  await driver.waitFor(
    `window.__e2e.all('[id^="history-item-"]').length >= 8`,
    30_000,
    'the image tiles',
  )

  const rest = await feedMetrics(driver)

  if (rest === null) {
    throw new Error('No island, tiles or scroll container')
  }

  if (Math.abs(rest.opacity - 1) > 0.01) {
    throw new Error(`Island opacity at rest is ${String(rest.opacity)}`)
  }

  if (rest.dataScrolled !== 'false') {
    throw new Error(`Island data-scrolled at rest is ${String(rest.dataScrolled)}`)
  }

  if (rest.firstTop < rest.islandBottom) {
    throw new Error(
      `First tile top ${String(rest.firstTop)} is above the island bottom ${String(rest.islandBottom)}`,
    )
  }

  await driver.click('[role="button"][aria-label="Open image details"]')
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the image viewer')
  await driver.clickLabel('Close')
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer to close')

  await setFeedScroll(driver, 200)
  await driver.waitFor(
    `(() => {
      const island = document.querySelector('[data-island]')
      return island !== null &&
        island.getAttribute('data-scrolled') === 'true' &&
        Math.abs(Number(getComputedStyle(island).opacity) - 0.1) < 0.002
    })()`,
    10_000,
    'the faded island after scroll',
  )

  const scrolled = await feedMetrics(driver)

  if (scrolled === null) {
    throw new Error('No island, tiles or scroll container after scroll')
  }

  if (scrolled.firstTop >= scrolled.islandBottom) {
    throw new Error(
      `First tile top ${String(scrolled.firstTop)} did not scroll under the island bottom ${String(scrolled.islandBottom)}`,
    )
  }

  await driver.hover('[data-island]')
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector('[data-island]')).opacity) > 0.9`,
    10_000,
    'the island hover opacity',
  )
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
  await driver.waitFor(
    `Math.abs(Number(getComputedStyle(document.querySelector('[data-island]')).opacity) - 0.1) < 0.002`,
    10_000,
    'the island fade after hover',
  )

  await setFeedScroll(driver, 0)
  await driver.waitFor(
    `(() => {
      const island = document.querySelector('[data-island]')
      return island !== null &&
        island.getAttribute('data-scrolled') === 'false' &&
        Number(getComputedStyle(island).opacity) > 0.99
    })()`,
    10_000,
    'the island at rest after scrolling back',
  )
}

async function shortRowOneHeight(context) {
  const { driver, server, width } = context
  const query = `e2e short row ${String(width)} ${String(Date.now())}`

  await seedImage(server, `${query} square`, { aspectRatio: '1:1' })
  await seedImage(server, `${query} tall`, { aspectRatio: '9:16' })

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setMasonryView(driver, { zoom: 5, filters: { q: query }, minTiles: 2 })
  const masonry = await measureMasonry(driver)

  if (masonry === null) {
    throw new Error('No masonry scroll container for the short row')
  }

  const firstRow = masonry.rows.at(0)

  if (firstRow === undefined || firstRow.length !== 2) {
    throw new Error(`Short first row has ${String(firstRow?.length)} tiles`)
  }

  const first = firstRow[0]
  const top = first.top
  const height = first.height

  for (const tile of firstRow) {
    if (!near(tile.top, top)) {
      throw new Error(`Row 1 top ${String(tile.top)} != ${String(top)}`)
    }

    if (!near(tile.height, height)) {
      throw new Error(`Row 1 height ${String(tile.height)} != ${String(height)}`)
    }
  }
}

async function pickerCardWidth(context) {
  const { driver, fixture, width } = context

  await fixture('refPickerImage')
  await openApp(context)
  await gotoTab(driver, 'Image')

  await openImagePicker(driver)
  await pickerTab(driver, 'Generations')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label^="Use "]')`,
    20_000,
    'an image generation card',
  )
  const imageCard = await rectOf(driver, '[aria-label^="Use "]')
  await driver.clickLabel('Close picker')
  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Close picker"]')`,
    10_000,
    'the image picker to close',
  )

  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )
  await driver.click('[data-references-box] button')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label="Close picker"]')`,
    15_000,
    'the video picker',
  )
  await pickerTab(driver, 'Image generations')
  await driver.waitFor(
    `window.__e2e.exists('[aria-label^="Use "]')`,
    20_000,
    'a video picker generation card',
  )
  const videoCard = await rectOf(driver, '[aria-label^="Use "]')

  if (imageCard === null || videoCard === null) {
    throw new Error('No picker card to measure')
  }

  console.log(
    `picker card width ${String(width)}: image ${String(imageCard.width)} video ${String(videoCard.width)}`,
  )

  if (!near(imageCard.width, videoCard.width, 1)) {
    throw new Error(
      `Picker card widths differ: image ${String(imageCard.width)} video ${String(videoCard.width)}`,
    )
  }
}

const NARROW_WIDTHS = [900, 920, 950]

function assertInside(rect, viewport, label) {
  if (rect.left < 0) {
    throw new Error(`${label} picker left ${String(rect.left)} < 0`)
  }

  if (rect.top < 0) {
    throw new Error(`${label} picker top ${String(rect.top)} < 0`)
  }

  if (rect.right > viewport.width) {
    throw new Error(`${label} picker right ${String(rect.right)} > ${String(viewport.width)}`)
  }

  if (rect.bottom > viewport.height) {
    throw new Error(`${label} picker bottom ${String(rect.bottom)} > ${String(viewport.height)}`)
  }
}

async function pickerInsideNarrowWindow(context) {
  const { driver, height, width } = context

  await openApp(context)
  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `window.__e2e.exists('[data-references-box]')`,
    10_000,
    'the video references box',
  )

  try {
    for (const narrow of NARROW_WIDTHS) {
      await driver.setViewport(narrow, height)
      await driver.waitFor(
        `window.innerWidth === ${String(narrow)}`,
        10_000,
        `a ${String(narrow)} px window`,
      )
      await driver.click('[data-references-box] button')
      await driver.waitFor(
        `window.__e2e.exists('[aria-label="Close picker"]')`,
        15_000,
        'the video picker',
      )

      const rect = await rectOf(driver, '[role="dialog"]')
      const viewport = await driver.evaluate(
        `({ width: window.innerWidth, height: window.innerHeight })`,
      )

      if (rect === null) {
        throw new Error('No video picker to measure')
      }

      console.log(
        `video picker ${String(narrow)}x${String(height)}: left=${String(rect.left)} top=${String(rect.top)} right=${String(rect.right)} bottom=${String(rect.bottom)}`,
      )
      assertInside(rect, viewport, `${String(narrow)}x${String(height)}`)

      await driver.clickLabel('Close picker')
      await driver.waitFor(
        `!window.__e2e.exists('[aria-label="Close picker"]')`,
        10_000,
        'the video picker to close',
      )
    }
  } finally {
    await driver.setViewport(width, height)
  }
}

export const layoutCases = [
  {
    name: 'layout/u4-full-row-u5-island',
    run: layoutMetrics,
  },
  {
    name: 'layout/clear-button-placement',
    run: clearButtonPlacement,
  },
  {
    name: 'layout/image-bar-controls',
    run: imageBarControls,
  },
  {
    name: 'layout/image-top-bar',
    run: imageTopBar,
  },
  {
    name: 'layout/short-row-one-height',
    run: shortRowOneHeight,
  },
  {
    name: 'layout/picker-card-width',
    run: pickerCardWidth,
  },
  {
    name: 'layout/picker-inside-narrow-window',
    run: pickerInsideNarrowWindow,
  },
]
