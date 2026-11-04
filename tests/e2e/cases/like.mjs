import {
  clickButtonStart,
  gotoTab,
  openApp,
  openImagePicker,
  pickerTab,
  setView,
} from '../lib/dom.mjs'

async function clickFirstLabel(driver, label) {
  const clicked = await driver.evaluate(`(() => {
    const node = window.__e2e.all('[aria-label=${JSON.stringify(label)}]').find((entry) => entry.offsetParent !== null) ??
      window.__e2e.all('[aria-label=${JSON.stringify(label)}]')[0]
    if (node === undefined) return false
    node.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No control labelled ${label}`)
  }
}

/** Clicks once the control renders. Revalidation can swap the heart between wait and click. */
async function clickWhenRendered(driver, selector) {
  await driver.waitFor(
    `(() => {
      const node = document.querySelector(${JSON.stringify(selector)})
      if (node === null) return false
      node.click()
      return true
    })()`,
    15_000,
    `the control ${selector}`,
  )
}

async function likeCardViewerFilterPicker(context) {
  const { driver, fixture } = context

  await fixture('savedImage')
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.all('[aria-label="Like"]').length > 0`,
    20_000,
    'the favorite card action',
  )
  await clickFirstLabel(driver, 'Like')
  await driver.waitFor(
    `window.__e2e.all('[aria-label="Liked"]').length > 0`,
    20_000,
    'the liked card state',
  )

  await driver.click('[role="button"][aria-label="Open image details"]')
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer')
  await driver.waitFor(
    `window.__e2e.all('[aria-label="Liked"]').length > 0`,
    15_000,
    'the liked viewer heart',
  )
  await clickWhenRendered(driver, '[role="dialog"] [aria-label="Liked"]')
  await driver.waitFor(
    `window.__e2e.exists('[role="dialog"] [aria-label="Like"]')`,
    15_000,
    'the viewer heart to unlike',
  )
  await clickWhenRendered(driver, '[role="dialog"] [aria-label="Like"]')
  await driver.waitFor(
    `window.__e2e.exists('[role="dialog"] [aria-label="Liked"]')`,
    15_000,
    'the viewer heart to like again',
  )
  await driver.clickLabel('Close')
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 15_000, 'the viewer to close')

  await clickButtonStart(driver, 'Filter')
  await driver.waitFor(`window.__e2e.exists('[role="switch"]')`, 10_000, 'the filter switch')
  const likedOnly = await driver.evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((node) => node.innerText.includes('Liked only'))
    const toggle = label?.querySelector('[role="switch"]')
    if (toggle === undefined || toggle === null) return false
    toggle.click()
    return true
  })()`)

  if (!likedOnly) {
    throw new Error('No Liked only filter')
  }

  await driver.waitFor(
    `window.__e2e.exists('[role="switch"][data-state="checked"]')`,
    10_000,
    'the liked filter to apply',
  )
  await driver.waitFor(
    `window.__e2e.all('[role="button"][aria-label="Open image details"]').length > 0`,
    15_000,
    'the liked grid tile',
  )

  await openImagePicker(driver)
  await pickerTab(driver, 'Liked')
  await driver.waitFor(
    `window.__e2e.all('[aria-label^="Use "]').length > 0`,
    20_000,
    'the liked picker tile',
  )
  await driver.clickLabel('Close picker')
  await driver.waitFor(
    `!window.__e2e.exists('[aria-label="Close picker"]')`,
    10_000,
    'picker close',
  )

  if (!(await driver.evaluate(`window.__e2e.exists('[role="switch"]')`))) {
    await clickButtonStart(driver, 'Filter')
  }

  await driver.waitFor(`window.__e2e.exists('[role="switch"]')`, 10_000, 'the filter panel')
  await driver.clickText('Reset')
  await driver.waitFor(
    `window.__e2e.exists('[role="switch"][data-state="unchecked"]')`,
    10_000,
    'the filter to reset',
  )
  await driver.pressKey('Escape')
}

export const likeCases = [
  {
    name: 'likes/card-viewer-filter-picker',
    run: likeCardViewerFilterPicker,
  },
]
