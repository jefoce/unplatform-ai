import { dropFile, gotoTab, openApp, PNG_1PX, resetLocal, setPrompt } from '../lib/dom.mjs'

const CHIP = '[data-prompt-editor] [data-beautiful-mention]'

function removeSelector(box) {
  return `${box} [aria-label^="Remove "]`
}

async function promptText(driver) {
  return driver.evaluate(`window.__e2e.promptText('[aria-label="Prompt"]')`)
}

async function waitReady(driver, options) {
  const { box, prompt } = options

  await setPrompt(driver, prompt)
  await dropFile(driver, 'clear-ref.png', 'image/png', PNG_1PX)
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(removeSelector(box))}).length === 1`,
    30_000,
    'the draft reference',
  )
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(CHIP)}).length === 1`,
    15_000,
    'the mention chip',
  )
}

async function waitCleared(driver, box) {
  await driver.waitFor(
    `(window.__e2e.promptText('[aria-label="Prompt"]') ?? '').trim() === ''`,
    10_000,
    'the cleared prompt',
  )
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(removeSelector(box))}).length === 0`,
    15_000,
    'the cleared references',
  )
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(CHIP)}).length === 0`,
    10_000,
    'the cleared mention chip',
  )
}

async function waitRestored(driver, options) {
  const { box, before } = options

  await driver.waitFor(
    `(window.__e2e.promptText('[aria-label="Prompt"]') ?? '') === ${JSON.stringify(before)}`,
    10_000,
    'the restored prompt',
  )
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(removeSelector(box))}).length === 1`,
    15_000,
    'the restored reference',
  )
  await driver.waitFor(
    `document.querySelectorAll(${JSON.stringify(CHIP)}).length === 1`,
    10_000,
    'the restored mention chip',
  )
}

async function clearAndUndo(driver, box) {
  const before = await promptText(driver)

  await driver.clickLabel('Clear prompt and inputs')
  await waitCleared(driver, box)
  await driver.clickText('Undo')
  await waitRestored(driver, { box, before })
}

async function clearUndoBothTabs(context) {
  const { driver } = context

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-draft', 'unplatform-ai:draft'])

  await gotoTab(driver, 'Image')
  await waitReady(driver, {
    box: '[data-image-references]',
    prompt: 'e2e clear image @Image 1',
  })
  await clearAndUndo(driver, '[data-image-references]')

  await gotoTab(driver, 'Video')
  await driver.clickText('References')
  await waitReady(driver, {
    box: '[data-references-box]',
    prompt: 'e2e clear video @Image 1',
  })
  await clearAndUndo(driver, '[data-references-box]')
}

export const promptCases = [
  {
    name: 'prompt/clear-undo',
    run: clearUndoBothTabs,
  },
]
