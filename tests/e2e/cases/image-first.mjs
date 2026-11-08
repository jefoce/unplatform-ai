import { gotoTab, openApp } from '../lib/dom.mjs'
import { seedImage } from '../lib/server.mjs'

async function pageStatus(server, key) {
  if (key === null) {
    return null
  }

  const response = await fetch(`${server.baseUrl}${key}`, {
    headers: { cookie: `upai_session=${server.token}` },
  })

  return response.status
}

async function deleteRecord(server, id) {
  const response = await fetch(`${server.baseUrl}/api/images/${id}`, {
    method: 'DELETE',
    headers: { cookie: `upai_session=${server.token}` },
  })

  if (!response.ok) {
    throw new Error(`DELETE /api/images/${id}: ${String(response.status)}`)
  }
}

async function imageFirstOpen(context) {
  const { driver, server, width } = context
  const record = await seedImage(server, `e2e image first ${String(Date.now())}`)

  try {
    await openApp(context)
    await gotoTab(driver, 'Image')
    await driver.waitFor(`window.__e2e.exists('[data-grid-width]')`, 10_000, 'the image grid')

    const first = await driver.evaluate(`(() => {
      const grid = document.querySelector('[data-grid-width]')
      const feed = document.querySelector('[data-image-page-key]')
      return {
        width: grid === null ? null : Number(grid.getAttribute('data-grid-width')),
        key: feed === null ? null : feed.getAttribute('data-image-page-key'),
      }
    })()`)
    const status = await pageStatus(server, first.key)

    console.log(
      `image-first ${String(width)}: ${JSON.stringify({ width: first.width, key: first.key, status })}`,
    )

    await driver.waitFor(
      `window.__e2e.all('[id^="history-item-"]').length >= 1`,
      10_000,
      'an image tile on the first Image open',
    )
  } finally {
    await deleteRecord(server, record.id)
  }
}

export const imageFirstCases = [
  {
    name: 'image-first/first-open',
    run: imageFirstOpen,
  },
]
