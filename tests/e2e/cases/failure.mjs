import { gotoTab, openApp, setView, waitBodyText } from '../lib/dom.mjs'

const FAILED_TEXT = 'Generation failed'

async function clickTileAction(driver, itemId, action) {
  const clicked = await driver.evaluate(`(() => {
    const tile = document.querySelector('#history-item-${itemId}')
    if (tile === null) return false
    const button = tile.querySelector('[aria-label=${JSON.stringify(action)}]')
    if (button === null) return false
    button.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No ${action} action on the failed tile`)
  }
}

async function clickDialogButton(driver, label) {
  const clicked = await driver.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (dialog === null) return false
    const button = [...dialog.querySelectorAll('button')].find((node) => node.innerText.trim() === ${JSON.stringify(label)})
    if (button === undefined) return false
    button.click()
    return true
  })()`)

  if (!clicked) {
    throw new Error(`No ${label} in the dialog`)
  }
}

async function failedProviderError(context) {
  const { driver, fixture } = context

  const failed = await fixture('failedImage')
  const outputId = failed.outputs[0].id
  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await waitBodyText(driver, FAILED_TEXT)

  await clickTileAction(driver, outputId, 'Regenerate')
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, 10_000, 'the regenerate confirm')
  const description = await driver.evaluate(`document.querySelector('[role="dialog"]').innerText`)

  if (!description.includes('Regenerate 1 image for ~$')) {
    throw new Error(`Regenerate confirm has no price: ${description}`)
  }

  await clickDialogButton(driver, 'Cancel')
  await driver.waitFor(`!window.__e2e.exists('[role="dialog"]')`, 10_000, 'the confirm to close')

  await clickTileAction(driver, outputId, 'Delete')
  await driver.waitFor(
    `window.__e2e.exists('[role="dialog"]') && document.querySelector('[role="dialog"]').innerText.includes('Delete image?')`,
    10_000,
    'the delete confirm',
  )
  await clickDialogButton(driver, 'Delete')
  await driver.waitFor(
    `!window.__e2e.exists('#history-item-${outputId}')`,
    20_000,
    'the failed placeholder to disappear',
  )
}

export const failureCases = [
  {
    name: 'failure/translated-retry-delete',
    run: failedProviderError,
  },
]
