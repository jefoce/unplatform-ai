import {
  clickGenerate,
  gotoTab,
  openApp,
  resetLocal,
  setPrompt,
  setView,
  titleWithCount,
  waitTitle,
} from '../lib/dom.mjs'
import { seedImage, waitRecord } from '../lib/server.mjs'

const INFINITE_RECORDS = 6
const ZOOM_RECORDS = 2
const IMAGES_PER_RECORD = 4

/** The app caps active image records at 4, so each batch waits before the next. */
const IMAGE_BATCH = 4

const BATCH_IMAGE_EXTRA = {
  count: IMAGES_PER_RECORD,
  presetId: 'seedream-5-0-lite',
  resolution: '2K',
}

function sortNewestFirst(records) {
  return [...records].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? 1 : -1
    }

    return left.id < right.id ? 1 : -1
  })
}

async function seedImageRecords(server, prefix, count) {
  const records = []

  for (let start = 0; start < count; start += IMAGE_BATCH) {
    const size = Math.min(IMAGE_BATCH, count - start)
    const batch = Array.from({ length: size }, (_, offset) => {
      return seedImage(server, `${prefix} ${String(start + offset)}`, BATCH_IMAGE_EXTRA)
    })

    records.push(...(await Promise.all(batch)))
  }

  return records
}

async function firstRowColumns(driver) {
  return driver.evaluate(`(() => {
    const tiles = window.__e2e.all('[id^="history-item-"]')
    if (tiles.length === 0) return 0
    const tops = tiles.map((node) => Math.round(node.getBoundingClientRect().top))
    const first = Math.min(...tops)
    return tops.filter((top) => top === first).length
  })()`)
}

async function waitColumns(driver, columns) {
  await driver.waitFor(
    `(() => {
      const tiles = window.__e2e.all('[id^="history-item-"]')
      if (tiles.length === 0) return false
      const tops = tiles.map((node) => Math.round(node.getBoundingClientRect().top))
      const first = Math.min(...tops)
      return tops.filter((top) => top === first).length === ${String(columns)}
    })()`,
    10_000,
    `${String(columns)} grid columns`,
  )
}

async function scrollFeedToEnd(driver, itemId) {
  const selector = `#history-item-${itemId}`
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    await driver.evaluate(`(() => {
      const scroll = [...document.querySelectorAll('div')].find((node) => {
        return getComputedStyle(node).overflowY === 'auto' && node.querySelector('[id^="history-item-"]') !== null
      })
      if (scroll === undefined) return false
      scroll.scrollTop = scroll.scrollHeight
      return true
    })()`)

    await new Promise((resolve) => {
      setTimeout(resolve, 250)
    })

    if (await driver.evaluate(`window.__e2e.exists(${JSON.stringify(selector)})`)) {
      return
    }
  }

  throw new Error(`The feed never reached ${selector}`)
}

async function infiniteScrollEnd(context) {
  const { driver, server } = context
  const suffix = String(Date.now())
  const records = await seedImageRecords(server, `e2e infinite ${suffix}`, INFINITE_RECORDS)
  const oldest = sortNewestFirst(records).at(-1)

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-view'])
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.all('[id^="history-item-"]').length > 0`,
    30_000,
    'the first page of the image feed',
  )
  await scrollFeedToEnd(driver, oldest.outputs.at(-1).id)
}

async function gridZoomColumns(context) {
  const { driver, server } = context
  const suffix = String(Date.now())

  await seedImageRecords(server, `e2e zoom ${suffix}`, ZOOM_RECORDS)

  await openApp(context)
  await resetLocal(driver, ['unplatform-ai:image-view'])
  await gotoTab(driver, 'Image')
  await setView(driver, 'Grid')
  await driver.waitFor(
    `window.__e2e.all('[id^="history-item-"]').length >= ${String(ZOOM_RECORDS * IMAGES_PER_RECORD)}`,
    30_000,
    'the zoom grid tiles',
  )
  await waitColumns(driver, 3)

  await driver.focus('[aria-label="Zoom"]')
  await driver.pressKey('Home')
  await waitColumns(driver, 8)

  if ((await firstRowColumns(driver)) !== 8) {
    throw new Error('The grid did not widen to eight columns')
  }

  await driver.pressKey('End')
  await waitColumns(driver, 3)

  if ((await firstRowColumns(driver)) !== 3) {
    throw new Error('The grid did not return to three columns')
  }
}

async function firstLoad(context) {
  const { driver } = context

  await openApp(context)
  await driver.waitFor(
    `document.body.innerText.includes('No generations yet')`,
    15_000,
    'the empty video feed',
  )
  await gotoTab(driver, 'Image')
  await driver.waitFor(
    `document.body.innerText.includes('No images yet')`,
    15_000,
    'the empty image feed',
  )
  await driver.waitFor(`window.__e2e.exists('[data-island]')`, 10_000, 'the island')
}

async function submitImage(context) {
  const { driver } = context
  const prompt = `e2e submit image ${String(Date.now())}`

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setPrompt(driver, prompt)
  await clickGenerate(driver)

  await driver.waitFor(
    `document.title === ${JSON.stringify(titleWithCount(1))}`,
    30_000,
    'the generating count in the title',
  )
  await driver.waitFor(
    `window.__e2e.all('[role="button"]').some((node) => node.getAttribute('aria-label') === 'Open image details')`,
    30_000,
    'the new image tile',
  )
  await waitTitle(driver, 'Unplatform AI', 90_000)
  await driver.waitFor(
    `!window.__e2e.exists('[data-status-pill]')`,
    90_000,
    'the image status to finish',
  )
  await driver.waitFor(
    `window.__e2e.all('[role="button"]').some((node) => node.getAttribute('aria-label') === 'Open image details')`,
    30_000,
    'the saved image tile',
  )
}

async function watchImageOnVideoTab(context) {
  const { driver } = context
  const prompt = `e2e hidden image ${String(Date.now())}`

  await openApp(context)
  await gotoTab(driver, 'Image')
  await setPrompt(driver, prompt)
  await clickGenerate(driver)

  await driver.waitFor(
    `document.title === ${JSON.stringify(titleWithCount(1))}`,
    30_000,
    'the generating count in the title',
  )

  await gotoTab(driver, 'Video')
  await driver.waitFor(
    `[...document.querySelectorAll('[data-sonner-toast]')].some((node) => node.innerText.includes(${JSON.stringify(prompt)}))`,
    90_000,
    'the image ready toast on the video tab',
  )
}

/** Captures ids from `/api/generations` create responses on the page. */
async function trackCreatedIds(driver) {
  await driver.evaluate(`(() => {
    window.__e2eCreatedIds = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init)
      const url = typeof input === 'string' ? input : input.url
      const method = init?.method ?? 'GET'
      const pathname = new URL(url, location.href).pathname
      if (method === 'POST' && pathname === '/api/generations') {
        try {
          const body = await response.clone().json()
          if (typeof body.id === 'string') window.__e2eCreatedIds.push(body.id)
        } catch {
          // Not a record response.
        }
      }
      return response
    }
    return true
  })()`)
}

async function submitVideoUntilDone(context) {
  const { driver } = context
  const prompt = `e2e submit video ${String(Date.now())}`

  await openApp(context)
  await gotoTab(driver, 'Video')
  await setView(driver, 'Grid')
  await trackCreatedIds(driver)
  await setPrompt(driver, prompt)
  await clickGenerate(driver)

  await driver.waitFor(`window.__e2eCreatedIds.length > 0`, 30_000, 'the created video record id')
  const id = await driver.evaluate(`window.__e2eCreatedIds[0]`)

  await driver.waitFor(
    `document.title === ${JSON.stringify(titleWithCount(1))}`,
    30_000,
    'the generating count in the title',
  )
  await driver.waitFor(
    `window.__e2e.all('[role="button"]').some((node) => node.getAttribute('aria-label') === 'Open video details')`,
    30_000,
    'the new video tile',
  )
  await waitTitle(driver, 'Unplatform AI', 90_000)
  await driver.waitFor(
    `!window.__e2e.exists('[data-status-pill]')`,
    90_000,
    'the video status to finish',
  )
  await driver.waitFor(
    `window.__e2e.all('[role="button"]').some((node) => node.getAttribute('aria-label') === 'Open video details')`,
    30_000,
    'the completed video tile',
  )

  return id
}

async function submitVideo(context) {
  await submitVideoUntilDone(context)
}

async function countFocusEvents(driver) {
  return driver.evaluate(`window.__e2eFocusEvents ?? 0`)
}

async function trackFocusEvents(driver) {
  await driver.evaluate(`(() => {
    window.__e2eFocusEvents = 0
    window.addEventListener('focus', () => {
      window.__e2eFocusEvents += 1
    })
    return true
  })()`)
}

async function videoPosterAfterComplete(context) {
  const { driver, server } = context

  await driver.send('Page.bringToFront')
  await trackFocusEvents(driver)

  const id = await submitVideoUntilDone(context)
  const record = await waitRecord(
    server,
    '/api/generations',
    id,
    (entry) => {
      return entry.status === 'completed'
    },
    'completed video',
  )

  const focusBefore = await countFocusEvents(driver)
  const selector = `#history-item-${record.id} img[src*="/api/thumbs/downloads/"]`

  await driver.waitFor(
    `(() => {
      const image = document.querySelector(${JSON.stringify(selector)})
      return image !== null && image.naturalWidth > 0
    })()`,
    10_000,
    'the fresh video poster to load',
  )

  if ((await countFocusEvents(driver)) !== focusBefore) {
    throw new Error('The fresh video poster appeared after a focus event')
  }
}

export const feedCases = [
  {
    name: 'feed/first-load',
    run: firstLoad,
    fresh: true,
  },
  {
    name: 'feed/submit-image',
    run: submitImage,
    fresh: true,
  },
  {
    name: 'feed/watch-image-on-video-tab',
    run: watchImageOnVideoTab,
    fresh: true,
  },
  {
    name: 'feed/submit-video',
    run: submitVideo,
    fresh: true,
  },
  {
    name: 'feed/video-poster-after-complete',
    run: videoPosterAfterComplete,
    fresh: true,
  },
  {
    name: 'feed/infinite-scroll-end',
    run: infiniteScrollEnd,
    fresh: true,
  },
  {
    name: 'feed/grid-zoom-columns',
    run: gridZoomColumns,
    fresh: true,
  },
]
