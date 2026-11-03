import { gotoTab, openApp, resetLocal, setView } from '../lib/dom.mjs'

const SAFE_ACTIONS = ['Regenerate', 'Reuse prompt', 'Add video as reference', 'Copy prompt']

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

export const menuCases = [
  {
    name: 'menu/more-safe-action',
    run: moreMenuSafeAction,
  },
]
