import { gotoTab, openApp, setView } from '../lib/dom.mjs'
import { createImageRecord } from '../lib/server.mjs'

const FLOOR_TILE_WIDTH = 240
const NARROW_TILE_WIDTH = 180
const VISIBLE_LABEL_MIN_PX = 2

async function setTileWidth(driver, width) {
  const applied = await driver.evaluate(`(() => {
    const grid = [...document.querySelectorAll('div.grid')].find((node) => {
      return node.querySelector('[id^="history-item-"]') !== null
    })
    if (grid === undefined) return false
    grid.style.gridTemplateColumns = '${String(width)}px'
    return true
  })()`)

  if (!applied) {
    throw new Error('No history grid')
  }

  await driver.waitFor(
    `(() => {
      const tile = document.querySelector('[id^="history-item-"] [role="button"]')
      if (tile === null) return false
      return Math.abs(tile.getBoundingClientRect().width - ${String(width)}) < 0.5
    })()`,
    10_000,
    `a ${String(width)} px tile`,
  )
}

async function waitLabels(driver, isStatusVisible, isCancelVisible) {
  await driver.waitFor(
    `(() => {
      const pill = document.querySelector('[data-status-pill]')
      const cancel = document.querySelector('[data-grace-cancel]')
      if (pill === null || cancel === null) return false
      const widthOf = (node) => {
        const label = node.querySelector('[data-status-label]')
        return label === null ? 0 : label.getBoundingClientRect().width
      }
      const statusShown = widthOf(pill) > ${String(VISIBLE_LABEL_MIN_PX)}
      const cancelShown = widthOf(cancel) > ${String(VISIBLE_LABEL_MIN_PX)}
      return statusShown === ${String(isStatusVisible)} && cancelShown === ${String(isCancelVisible)}
    })()`,
    10_000,
    'the status labels to fit the tile',
  )
}

async function readRow(driver) {
  return driver.evaluate(`(() => {
    const pill = document.querySelector('[data-status-pill]')
    const cancel = document.querySelector('[data-grace-cancel]')
    if (pill === null || cancel === null) return null
    const tile = pill.closest('[role="button"]')
    return {
      pillTop: pill.getBoundingClientRect().top,
      cancelTop: cancel.getBoundingClientRect().top,
      tileWidth: tile === null ? 0 : tile.getBoundingClientRect().width,
    }
  })()`)
}

/** Cancel collapses to its icon before the status label, and stays on the pill row. */
async function cancelBesidePill(context) {
  const { driver, server } = context

  await createImageRecord(server, `e2e pill fit ${String(Date.now())}`)
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')

  await driver.waitFor(
    `window.__e2e.exists('[data-status-pill]') && window.__e2e.exists('[data-grace-cancel]')`,
    10_000,
    'the grace cancel pill',
  )

  await setTileWidth(driver, FLOOR_TILE_WIDTH)
  await waitLabels(driver, true, false)

  const row = await readRow(driver)

  if (row === null) {
    throw new Error('The status row disappeared')
  }

  if (row.tileWidth < FLOOR_TILE_WIDTH) {
    throw new Error(`The tile is ${String(row.tileWidth)} px, below the label floor`)
  }

  if (Math.abs(row.cancelTop - row.pillTop) > 1) {
    throw new Error(
      `Cancel top ${String(row.cancelTop)} does not match pill top ${String(row.pillTop)}`,
    )
  }

  await setTileWidth(driver, NARROW_TILE_WIDTH)
  await waitLabels(driver, false, false)
}

export const statusCases = [
  {
    name: 'status/cancel-beside-pill',
    run: cancelBesidePill,
  },
]
