import { gotoTab, openApp, setView } from '../lib/dom.mjs'
import { createImageRecord } from '../lib/server.mjs'

async function selectRecords(driver, prompts) {
  const clicked = await driver.evaluate(`(() => {
    const prompts = ${JSON.stringify(prompts)}
    let count = 0
    for (const prompt of prompts) {
      const box = window.__e2e.all('[role="checkbox"]').find((node) => (node.getAttribute('aria-label') ?? '').includes(prompt))
      if (box === undefined) continue
      box.click()
      count += 1
    }
    return count
  })()`)

  if (clicked !== prompts.length) {
    throw new Error(`Selected ${String(clicked)} of ${String(prompts.length)} records`)
  }

  await driver.waitFor(
    `document.body.innerText.includes(${JSON.stringify(`${String(prompts.length)} selected`)})`,
    10_000,
    'the selection count',
  )

  return clicked
}

async function mixedSelection(context) {
  const { driver, server, fixture } = context

  const selectedImage = await fixture('selectionSavedImage')
  const selectedFailed = await fixture('selectionFailedImage')
  const pending = await createImageRecord(server, `e2e pending ${String(Date.now())}`)

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.exists('[data-status-pill]')`,
    30_000,
    'the pending image tile',
  )

  const pendingHasCheckbox = await driver.evaluate(`(() => {
    const tile = window.__e2e.all('[role="button"]').find((node) => node.querySelector('[data-status-pill]') !== null)
    if (tile === undefined) return true
    return tile.querySelector('[role="checkbox"]') !== null
  })()`)

  if (pendingHasCheckbox) {
    throw new Error('Pending image tile is selectable')
  }

  await selectRecords(driver, [selectedImage.input.prompt, selectedFailed.input.prompt])

  const downloadLabel = await driver.evaluate(`(() => {
    const button = window.__e2e.all('button').find((node) => /^Download \\d+$/.test(node.innerText.trim()))
    return button?.innerText.trim() ?? null
  })()`)

  if (downloadLabel !== 'Download 1') {
    throw new Error(`Selection bar shows ${String(downloadLabel)} for two selected records`)
  }

  await driver.evaluate(`window.confirm = () => true`)
  await driver.clickText(downloadLabel)
  await driver.waitFor(
    `document.body.innerText.includes('not finished, skipped')`,
    15_000,
    'the skipped download toast',
  )

  await driver.evaluate(`(() => {
    const button = window.__e2e.all('[aria-label]').find((node) => (node.getAttribute('aria-label') ?? '').startsWith('Delete selected'))
    if (button === undefined) return false
    button.click()
    return true
  })()`)
  await driver.waitFor(
    `(() => {
      const toolbar = document.querySelector('[role="toolbar"]')
      return toolbar === null || toolbar.inert === true
    })()`,
    30_000,
    'the selection to clear',
  )

  for (const record of [selectedImage, selectedFailed]) {
    const result = await server.api(`/api/images?ids=${record.id}`)

    if (result.items.length > 0) {
      throw new Error(`Image ${record.id} still exists after delete`)
    }
  }

  const pendingAfter = await server.api(`/api/images?ids=${pending.id}`)

  if (pendingAfter.items.length === 0) {
    throw new Error('Download or delete removed the pending image')
  }
}

export const selectionCases = [
  {
    name: 'selection/mixed-download-delete',
    run: mixedSelection,
  },
]
