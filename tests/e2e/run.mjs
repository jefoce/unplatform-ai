import fs from 'node:fs/promises'
import path from 'node:path'

import { cspCases } from './cases/csp.mjs'
import { creditsCases } from './cases/credits.mjs'
import { customCases } from './cases/custom.mjs'
import { failureCases } from './cases/failure.mjs'
import { feedCases } from './cases/feed.mjs'
import { layoutCases } from './cases/layout.mjs'
import { likeCases } from './cases/like.mjs'
import { menuCases } from './cases/menu.mjs'
import { motionCases } from './cases/motion.mjs'
import { persistenceCases } from './cases/persistence.mjs'
import { promptCases } from './cases/prompt.mjs'
import { referenceCases } from './cases/references.mjs'
import { selectionCases } from './cases/selection.mjs'
import { sessionCases } from './cases/session.mjs'
import { statusCases } from './cases/status.mjs'
import { viewerCases } from './cases/viewer.mjs'
import { assertHoverMedia, findChrome, startBrowser, stopBrowser, TEMP_BASE } from './lib/cdp.mjs'
import { buildApp, seedFailedImage, seedImage, seedVideo, startServer } from './lib/server.mjs'

const WIDTHS = [1280, 1728, 2560]
const HEIGHT = 900
const OUTBOUND_MARKER = '[e2e-outbound] blocked'

let outbound = 0

const CASES = [
  ...cspCases,
  ...creditsCases,
  ...customCases,
  ...feedCases,
  ...likeCases,
  ...failureCases,
  ...selectionCases,
  ...sessionCases,
  ...statusCases,
  ...viewerCases,
  ...referenceCases,
  ...persistenceCases,
  ...promptCases,
  ...layoutCases,
  ...menuCases,
  ...motionCases,
]

function parseList(value) {
  if (value === undefined) {
    return null
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

function argValue(prefix) {
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found?.slice(prefix.length)
}

const requestedWidths = parseList(argValue('--width='))
const caseFilter = argValue('--case=')
const widths = requestedWidths === null ? WIDTHS : requestedWidths.map(Number)
const cases =
  caseFilter === undefined ? CASES : CASES.filter((entry) => entry.name.includes(caseFilter))

function fixtureLoader(name, server, width) {
  const suffix = String(width)

  const loaders = {
    savedImage: () => seedImage(server, `e2e saved image ${suffix}`),
    savedVideo: () => seedVideo(server, `e2e saved video ${suffix}`, { resolution: '480p' }),
    failedImage: () => seedFailedImage(server, `e2e failed image ${suffix}`),
    refCardImage: () => seedImage(server, `e2e ref card ${suffix}`),
    refViewerImage: () => seedImage(server, `e2e ref viewer ${suffix}`),
    refPickerImage: () => seedImage(server, `e2e ref picker ${suffix}`),
    selectionSavedImage: () => seedImage(server, `e2e selection saved ${suffix}`),
    selectionFailedImage: () => seedFailedImage(server, `e2e selection failed ${suffix}`),
    layoutSquare: () => seedImage(server, `e2e layout square ${suffix}`, { aspectRatio: '1:1' }),
    layoutWide: () => seedImage(server, `e2e layout wide ${suffix}`, { aspectRatio: '16:9' }),
    layoutTall: () => seedImage(server, `e2e layout tall ${suffix}`, { aspectRatio: '9:16' }),
  }
  const loader = loaders[name]

  if (loader === undefined) {
    throw new Error(`Unknown fixture: ${name}`)
  }

  return loader
}

function makeContext(browser, server, width) {
  const cache = new Map()

  return {
    driver: browser.driver,
    server,
    width,
    height: HEIGHT,
    fixture(name) {
      if (!cache.has(name)) {
        cache.set(name, fixtureLoader(name, server, width)())
      }

      return cache.get(name)
    },
  }
}

function outboundBlocked(logs) {
  return logs.join('').match(/\[e2e-outbound\] blocked \S+/g) ?? []
}

function printRow(row) {
  const result = row.isPass ? 'PASS' : 'FAIL'
  const width = String(row.width).padEnd(5)
  const name = row.name.padEnd(46)
  const time = `${String(row.ms)}ms`.padEnd(8)
  const reason = row.error === undefined ? '' : ` ${row.error.split('\n')[0]}`

  console.log(`${width} ${name} ${result.padEnd(5)} ${time}${reason}`)
}

async function cleanupStorage(server) {
  const resolved = path.resolve(server.storageRoot)
  const relative = path.relative(path.resolve(TEMP_BASE), resolved)

  if (
    process.env.E2E_KEEP_TMP?.trim() === '1' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    return
  }

  await fs.rm(resolved, { recursive: true, force: true })
}

async function runWidth(width, rows) {
  console.log(`\n# width ${String(width)}`)
  const server = await startServer()
  let browser = null
  let logIndex = 0

  try {
    browser = await startBrowser(width, HEIGHT)
    await assertHoverMedia(browser.driver)
    const context = makeContext(browser, server, width)

    for (const entry of cases) {
      const started = Date.now()
      let error

      try {
        await entry.run(context)
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught)
      }

      const blocked = outboundBlocked(server.logs.slice(logIndex))
      logIndex = server.logs.length
      outbound += blocked.length

      if (blocked.length > 0) {
        const url = blocked[0].slice(OUTBOUND_MARKER.length + 1)
        const violation = `Outbound request blocked in mock mode: ${url}`
        error = error === undefined ? violation : `${error}\n${violation}`
      }

      rows.push({
        width,
        name: entry.name,
        isPass: error === undefined,
        ms: Date.now() - started,
        error,
      })
      printRow(rows.at(-1))
    }
  } finally {
    if (browser !== null) {
      await stopBrowser(browser)
    }

    await server.stop()
    await cleanupStorage(server)
  }
}

async function main() {
  if (cases.length === 0) {
    throw new Error(`No case matches --case=${String(caseFilter)}`)
  }

  for (const width of widths) {
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error(`Bad width: ${String(width)}`)
    }
  }

  const attachedPort = process.env.E2E_CDP_PORT?.trim()

  if (attachedPort === undefined || attachedPort === '') {
    await findChrome()
  }

  await buildApp()
  await fs.mkdir(TEMP_BASE, { recursive: true })

  const rows = []

  // One build, one server per width: every selected case for a width shares its server.
  for (const width of widths) {
    await runWidth(width, rows)
  }

  const passed = rows.filter((row) => {
    return row.isPass
  }).length
  const failed = rows.length - passed

  console.log(
    `\n${String(passed)}/${String(rows.length)} passed, ${String(failed)} failed, ${String(outbound)} outbound blocked`,
  )

  if (failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
