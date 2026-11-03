import {
  clickButtonStart,
  dropFile,
  gotoTab,
  openApp,
  PNG_1PX,
  resetLocal,
  setPrompt,
  setView,
} from '../lib/dom.mjs'
import { seedFailedVideo } from '../lib/server.mjs'

async function reusePrompt(driver) {
  await driver.waitFor(
    `window.__e2e.all('[aria-label="More actions"]').length > 0`,
    15_000,
    'a card menu',
  )
  await driver.mouseClick('[aria-label="More actions"]')
  await driver.waitFor(
    `window.__e2e.all('[role="menuitem"]').some((node) => node.innerText.includes('Reuse prompt'))`,
    10_000,
    'the reuse menu item',
  )
  await driver.clickText('Reuse prompt')
}

async function draftsPersistAndReuse(context) {
  const { driver, fixture } = context

  await fixture('savedImage')
  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-draft', 'unplatform-ai:draft'])

  await gotoTab(driver, 'Image')
  await setPrompt(driver, 'e2e persist image')
  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await setPrompt(driver, 'e2e persist video')

  await gotoTab(driver, 'Image')
  await dropFile(driver, 'persist-ref.png', 'image/png', PNG_1PX)
  await driver.waitFor(
    `document.querySelectorAll('[data-image-references] [aria-label^="Remove "]').length === 1`,
    30_000,
    'the draft reference',
  )

  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-island]') || window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app after reload',
  )

  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await driver.waitFor(
    `(window.__e2e.promptText('[aria-label="Prompt"]') ?? '').includes('e2e persist video')`,
    15_000,
    'the persisted video prompt',
  )

  await gotoTab(driver, 'Image')
  await driver.waitFor(
    `(window.__e2e.promptText('[aria-label="Prompt"]') ?? '').includes('e2e persist image')`,
    15_000,
    'the persisted image prompt',
  )
  await driver.waitFor(
    `window.__e2e.exists('[data-image-references] [aria-label="Remove persist-ref.png"]')`,
    30_000,
    'the restored image reference',
  )

  await setView(driver, 'Grid')
  await reusePrompt(driver)
  await driver.waitFor(
    `!window.__e2e.exists('[data-image-references]')`,
    20_000,
    'the reused prompt to replace references',
  )
  const prompt = await driver.evaluate(`window.__e2e.promptText('[aria-label="Prompt"]')`)

  if (prompt.includes('e2e persist image')) {
    throw new Error('Reuse prompt did not replace the draft prompt')
  }
}

async function videoFilterSurvivesReload(context) {
  const { driver, server, fixture } = context
  const savedVideo = fixture('savedVideo')
  const failedVideo = seedFailedVideo(server, `e2e video filter failed ${String(Date.now())}`)
  const [saved, failed] = await Promise.all([savedVideo, failedVideo])

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await driver.waitFor(
    `document.body.innerText.includes(${JSON.stringify(failed.input.prompt)})`,
    30_000,
    'the failed video tile',
  )
  await clickButtonStart(driver, 'Filter')
  await driver.waitFor(
    `window.__e2e.exists('button[value="failed"]')`,
    10_000,
    'the failed status filter',
  )
  await driver.evaluate(`document.querySelector('button[value="failed"]').click()`)
  await driver.waitFor(
    `!document.body.innerText.includes(${JSON.stringify(saved.input.prompt)})`,
    30_000,
    'the completed video to leave the filtered feed',
  )

  await driver.reload()
  await driver.waitFor(
    `window.__e2e.exists('[data-generator-panel]')`,
    30_000,
    'the app after reload',
  )
  await driver.waitFor(
    `document.body.innerText.includes(${JSON.stringify(failed.input.prompt)})`,
    30_000,
    'the failed video after reload',
  )

  const isSavedHidden = await driver.evaluate(
    `!document.body.innerText.includes(${JSON.stringify(saved.input.prompt)})`,
  )

  if (!isSavedHidden) {
    throw new Error('The completed video returned after reload')
  }

  await clickButtonStart(driver, 'Filter')
  await driver.waitFor(
    `(() => {
      const button = document.querySelector('button[value="failed"]')
      return button !== null && button.getAttribute('aria-pressed') === 'true'
    })()`,
    10_000,
    'the failed filter after reload',
  )
}

export const persistenceCases = [
  {
    name: 'persistence/drafts-reload-reuse',
    run: draftsPersistAndReuse,
  },
  {
    name: 'persistence/video-filter-reload',
    run: videoFilterSurvivesReload,
  },
]
