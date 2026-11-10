import { gotoTab, openApp, resetLocal, setView } from '../lib/dom.mjs'
import { seedVideo } from '../lib/server.mjs'

const RATIOS = ['1:1', '16:9', '9:16', '21:9']
const WAIT_MS = 15_000

async function openDetails(context, id) {
  const { driver } = context

  await driver.waitFor(`window.__e2e.exists('#history-item-${id}')`, WAIT_MS, 'the video tile')
  await driver.click(`#history-item-${id} [role="button"]`)
  await driver.waitFor(`window.__e2e.exists('[role="dialog"]')`, WAIT_MS, 'the details dialog')
}

async function closeDetails(driver) {
  await driver.clickLabel('Close')
  await driver.waitFor(
    `!window.__e2e.exists('[role="dialog"]')`,
    WAIT_MS,
    'the details dialog to close',
  )
}

async function captureChips(context, record) {
  const { driver, width } = context
  const aspect = record.input.aspectRatio.replaceAll(':', 'x')

  await openDetails(context, record.id)
  const file = await driver.captureScreenshot(`details-chips-${aspect}-${String(width)}`)

  console.log(`# screenshot ${file}`)
  await closeDetails(driver)
}

async function captureDetailsChips(context) {
  const { driver, server } = context
  const stamp = String(Date.now())
  const records = await Promise.all(
    RATIOS.map((aspect) => {
      const prompt = `e2e details chips ${aspect} ${stamp}`

      return seedVideo(server, prompt, {
        presetId: 'seedance-2.5',
        aspectRatio: aspect,
        resolution: '480p',
      })
    }),
  )

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:view'])
  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')

  for (const record of records) {
    await captureChips(context, record)
  }
}

export const detailsCases = [
  {
    name: 'history/chip-icons',
    run: captureDetailsChips,
  },
]
