import { NO_HOVER_MEDIA_FLAGS, readMediaQueries, startBrowser, stopBrowser } from '../lib/cdp.mjs'
import { gotoTab, openApp, resetLocal, setView } from '../lib/dom.mjs'

const SAFE_ACTIONS = ['Regenerate', 'Reuse prompt', 'Add video as reference', 'Copy prompt']
const NO_HOVER_QUERIES = [
  '(hover: none)',
  '(pointer: none)',
  '(any-hover: none)',
  '(any-pointer: none)',
]

async function moreMenuSafeAction(context) {
  const { driver, fixture } = context
  const video = await fixture('savedVideo')

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view', 'unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')
  await driver.waitFor(`window.__e2e.exists('#history-item-${video.id}')`, 30_000, 'the video tile')
  await driver.mouseClick(`#history-item-${video.id} [aria-label="More actions"]`)
  await driver.waitFor(`window.__e2e.exists('[role="menu"]')`, 10_000, 'the more menu')

  const labels = await driver.evaluate(
    `window.__e2e.all('[role="menuitem"]').map((node) => node.innerText.trim())`,
  )

  for (const action of SAFE_ACTIONS) {
    if (!labels.includes(action)) {
      throw new Error(`The more menu is missing ${action}: ${labels.join(', ')}`)
    }
  }

  await driver.clickText('Reuse prompt')
  await driver.waitFor(
    `document.body.innerText.includes('Settings loaded')`,
    15_000,
    'the reuse prompt action',
  )
}

async function openSavedVideoGrid(context) {
  const { driver } = context
  const video = await context.fixture('savedVideo')

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view', 'unplatform-ai:draft'])
  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')
  await driver.waitFor(`window.__e2e.exists('#history-item-${video.id}')`, 30_000, 'the video tile')

  return `#history-item-${video.id} [aria-label="More actions"]`
}

async function revealsThenHidesAfterMouseAction(context) {
  const { driver, width } = context
  const trigger = await openSavedVideoGrid(context)

  await driver.evaluate(`(() => {
    const original = window.fetch
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/reveal')) return Promise.resolve(new Response(null, { status: 204 }))
      return original.call(window, input, init)
    }
  })()`)

  await driver.mouseClick(trigger)
  await driver.waitFor(`window.__e2e.exists('[role="menu"]')`, 10_000, 'the more menu')

  const tagged = await driver.evaluate(`(() => {
    const item = window.__e2e.all('[role="menuitem"]').find((node) => /Reveal|Show in/.test(node.innerText))
    if (item === undefined) return false
    item.dataset.e2eTarget = 'reveal'
    return true
  })()`)

  if (!tagged) {
    throw new Error('The more menu has no reveal item')
  }

  await driver.mouseClick('[data-e2e-target="reveal"]')
  await driver.waitFor(`!window.__e2e.exists('[role="menu"]')`, 10_000, 'the menu to close')
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector(${JSON.stringify(trigger)})).opacity) < 0.1`,
    10_000,
    'the more menu button to hide after a mouse action',
  )

  console.log(`# mouse close at ${String(width)} px hid the more menu button`)
}

async function keepsFocusAfterKeyboardClose(context) {
  const { driver } = context
  const trigger = await openSavedVideoGrid(context)

  await driver.focus(trigger)
  await driver.pressKey('Enter')
  await driver.waitFor(`window.__e2e.exists('[role="menu"]')`, 10_000, 'the more menu')
  await driver.pressKey('Escape')
  await driver.waitFor(
    `document.activeElement === document.querySelector(${JSON.stringify(trigger)})`,
    10_000,
    'the more menu button to keep focus',
  )
  await driver.waitFor(
    `Number(getComputedStyle(document.querySelector(${JSON.stringify(trigger)})).opacity) > 0.9`,
    10_000,
    'the more menu button to stay visible',
  )
}

async function moreMenuWithoutHover(context) {
  const { server, width, height } = context
  const video = await context.fixture('savedVideo')
  const browser = await startBrowser(width, height, {
    mediaFlags: NO_HOVER_MEDIA_FLAGS,
    forceLaunch: true,
  })

  try {
    const { driver } = browser
    const media = await readMediaQueries(driver, NO_HOVER_QUERIES)

    console.log(`# no-hover media ${JSON.stringify(media)}`)

    if (!media['(hover: none)']) {
      throw new Error(`Chrome did not report hover none: ${JSON.stringify(media)}`)
    }

    const noHover = { driver, server, width, height, fixture: context.fixture }

    await openApp(noHover)
    await resetLocal(driver, ['unplatform-ai:view', 'unplatform-ai:draft'])
    await gotoTab(driver, 'Video')
    await setView(driver, 'Grid')
    await driver.waitFor(
      `window.__e2e.exists('#history-item-${video.id}')`,
      30_000,
      'the video tile',
    )

    const selector = `#history-item-${video.id} [aria-label="More actions"]`

    await driver.focus(`#history-item-${video.id} [aria-label="Download"]`)
    await driver.pressKey('Tab')
    await driver.waitFor(
      `Number(getComputedStyle(document.querySelector(${JSON.stringify(selector)})).opacity) > 0.9`,
      10_000,
      'the more menu button to reveal on keyboard focus',
    )
    await driver.pressKey('Enter')
    await driver.waitFor(
      `window.__e2e.exists('[role="menu"]')`,
      10_000,
      'the more menu without hover',
    )
    await driver.pressKey('Escape')
  } finally {
    await stopBrowser(browser)
  }
}

export const menuCases = [
  {
    name: 'menu/more-safe-action',
    run: moreMenuSafeAction,
  },
  {
    name: 'menu/more-without-hover',
    run: moreMenuWithoutHover,
  },
  {
    name: 'menu/hide-after-mouse-action',
    run: revealsThenHidesAfterMouseAction,
  },
  {
    name: 'menu/keep-focus-after-keyboard-close',
    run: keepsFocusAfterKeyboardClose,
  },
]
