import { gotoTab, openApp } from '../lib/dom.mjs'
import { seedImage } from '../lib/server.mjs'

const VIEW_KEY = 'unplatform-ai:image-view'
const MIN_ROW_HEIGHT = 150
const COMPACT_BUTTON = 24
const DEFAULT_BUTTON = 32
const COMPACT_CHECKBOX = 16
const COMPACT_BADGE = 20

function near(actual, expected, tolerance = 0.5) {
  return Math.abs(actual - expected) <= tolerance
}

async function setMasonryView(driver, params) {
  const { zoom, filters = {}, minTiles } = params
  const state = { view: 'masonry', zoom, filters }

  await driver.evaluate(
    `localStorage.setItem(${JSON.stringify(VIEW_KEY)}, ${JSON.stringify(JSON.stringify({ state, version: 1 }))})`,
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

async function measureActions(driver, selector) {
  return driver.evaluate(`(() => {
    const tile = document.querySelector(${JSON.stringify(selector)})
    if (tile === null) return null
    const tileRect = tile.getBoundingClientRect()
    const buttons = [...tile.querySelectorAll('button[aria-label]')]
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.left > tileRect.left + tileRect.width / 2
      })
      .map((node) => {
        const rect = node.getBoundingClientRect()
        return {
          label: node.getAttribute('aria-label'),
          width: rect.width,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          opacity: Number(getComputedStyle(node).opacity),
        }
      })
    return {
      tile: {
        left: tileRect.left,
        right: tileRect.right,
        top: tileRect.top,
        bottom: tileRect.bottom,
        width: tileRect.width,
        height: tileRect.height,
      },
      buttons,
    }
  })()`)
}

function visibleAction(buttons) {
  return buttons.find((button) => {
    return button.label !== 'More actions' && button.opacity > 0.9
  })
}

async function waitForActions(driver, selector) {
  await driver.waitFor(
    `(() => {
      const tile = document.querySelector(${JSON.stringify(selector)})
      if (tile === null) return false
      const tileRect = tile.getBoundingClientRect()
      return [...tile.querySelectorAll('button[aria-label]')].some((node) => {
        const rect = node.getBoundingClientRect()
        return rect.left > tileRect.left + tileRect.width / 2 && Number(getComputedStyle(node).opacity) > 0.9
      })
    })()`,
    10_000,
    'the revealed action buttons',
  )
}

async function compactActions(context) {
  const { driver, server, width, height } = context
  const query = `e2e card actions ${String(width)} ${String(Date.now())}`

  for (let index = 0; index < 9; index += 1) {
    await seedImage(server, `${query} ${String(index)}`, { aspectRatio: '21:9' })
  }

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setMasonryView(driver, { zoom: 0, filters: { q: query }, minTiles: 9 })

  const heights = await driver.evaluate(
    `window.__e2e.all('[id^="history-item-"]').map((node) => node.getBoundingClientRect().height)`,
  )

  for (const tileHeight of heights) {
    if (tileHeight < MIN_ROW_HEIGHT) {
      throw new Error(`Masonry tile height ${String(tileHeight)} < ${String(MIN_ROW_HEIGHT)}`)
    }
  }

  const formattedHeights = heights.map((tileHeight) => {
    return tileHeight.toFixed(2)
  })
  const minHeight = Math.min(...heights)
  const maxHeight = Math.max(...heights)

  console.log(
    `# tiles ${String(heights.length)} heights ${formattedHeights.join(', ')} min ${minHeight.toFixed(2)} max ${maxHeight.toFixed(2)}`,
  )

  await driver.hover('[data-compact="true"]')
  await waitForActions(driver, '[data-compact="true"]')

  const compact = await measureActions(driver, '[data-compact="true"]')

  if (compact === null) {
    throw new Error('No compact tile to measure')
  }

  const actionButton = visibleAction(compact.buttons)

  if (actionButton === undefined) {
    throw new Error('No visible compact action button')
  }

  if (!near(actionButton.width, COMPACT_BUTTON)) {
    throw new Error(
      `Compact action button width ${String(actionButton.width)} != ${String(COMPACT_BUTTON)}`,
    )
  }

  for (const button of compact.buttons) {
    if (
      button.left < compact.tile.left ||
      button.right > compact.tile.right ||
      button.top < compact.tile.top ||
      button.bottom > compact.tile.bottom
    ) {
      throw new Error(`Compact action ${String(button.label)} is outside the tile`)
    }
  }

  const lastBottom = Math.max(
    ...compact.buttons.map((button) => {
      return button.bottom
    }),
  )

  if (lastBottom > compact.tile.bottom - 8) {
    throw new Error(
      `Compact action column bottom ${String(lastBottom)} is not 8px above the tile bottom ${String(compact.tile.bottom)}`,
    )
  }

  console.log(
    `# compact column bottom ${lastBottom.toFixed(2)} tile bottom ${compact.tile.bottom.toFixed(2)}`,
  )

  const checkbox = await driver.evaluate(`(() => {
    const node = document.querySelector('[data-compact="true"] [role="checkbox"]')
    if (node === null) return null
    const rect = node.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })()`)

  if (checkbox === null) {
    throw new Error('No compact selection checkbox to measure')
  }

  if (!near(checkbox.width, COMPACT_CHECKBOX) || !near(checkbox.height, COMPACT_CHECKBOX)) {
    throw new Error(
      `Compact checkbox ${String(checkbox.width)}x${String(checkbox.height)} != ${String(COMPACT_CHECKBOX)}`,
    )
  }

  console.log(`# compact checkbox ${checkbox.width.toFixed(2)}x${checkbox.height.toFixed(2)}`)
  console.log(`# compact ${String(width)}x${String(height)} button ${String(actionButton.width)}`)
  console.log(
    `# screenshot ${await driver.captureScreenshot(`card-actions-compact-${String(width)}`)}`,
  )

  await driver.waitFor(
    `(() => {
      const tile = document.querySelector('[data-compact="true"]')
      if (tile === null) return false
      return [...tile.querySelectorAll('button[aria-label="Like"]')].some((node) => {
        return Number(getComputedStyle(node).opacity) > 0.9
      })
    })()`,
    10_000,
    'the visible favorite action',
  )

  await driver.mouseClick('[data-compact="true"] button[aria-label="Like"]')
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 })
  await driver.waitFor(
    `document.querySelector('[data-compact="true"] button[aria-label="Liked"]') !== null`,
    10_000,
    'the liked badge on the compact tile',
  )

  const badgeHeight = await driver.evaluate(`(() => {
    const node = document.querySelector('[data-compact="true"] button[aria-label="Liked"]')
    if (node === null) return 0
    return node.getBoundingClientRect().height
  })()`)

  if (!near(badgeHeight, COMPACT_BADGE)) {
    throw new Error(`Compact liked badge height ${String(badgeHeight)} != ${String(COMPACT_BADGE)}`)
  }

  console.log(`# compact liked badge height ${badgeHeight.toFixed(2)}`)

  await context.fixture('layoutSquare')
  await context.fixture('layoutWide')
  await setMasonryView(driver, { zoom: 5, filters: { q: 'e2e layout' }, minTiles: 2 })
  await gotoTab(driver, 'Image')

  const isCompact = await driver.evaluate(
    `document.querySelector('[id^="history-item-"] [data-compact="true"]') !== null`,
  )

  if (isCompact) {
    throw new Error('Default zoom tile is still compact')
  }

  await driver.hover('[id^="history-item-"]')
  await waitForActions(driver, '[id^="history-item-"]')

  const normal = await measureActions(driver, '[id^="history-item-"]')

  if (normal === null) {
    throw new Error('No default tile to measure')
  }

  const normalButton = visibleAction(normal.buttons)

  if (normalButton === undefined) {
    throw new Error('No visible default action button')
  }

  if (normalButton.width < DEFAULT_BUTTON) {
    throw new Error(
      `Default action button width ${String(normalButton.width)} < ${String(DEFAULT_BUTTON)}`,
    )
  }

  console.log(`# default button ${String(normalButton.width)}`)
  console.log(`# default tile ${normal.tile.height.toFixed(2)}`)
  console.log(
    `# screenshot ${await driver.captureScreenshot(`card-actions-default-${String(width)}`)}`,
  )
}

export const cardActionsCases = [
  {
    name: 'card-actions/compact',
    run: compactActions,
  },
]
