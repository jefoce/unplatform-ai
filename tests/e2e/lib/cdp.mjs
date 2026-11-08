import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { checkChromeMajor } from './chrome-version.mjs'

const POLL_MS = 100
const IDLE_QUIET_MS = 500

/** Forces a mouse and hover in headless Chrome, which reports none on Linux CI. */
export const HOVER_MEDIA_FLAGS =
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4'

/** Reports no hover and no pointer, for the no-hover control case. */
export const NO_HOVER_MEDIA_FLAGS =
  '--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=1,availablePointerTypes=1'

const HOVER_QUERIES = [
  '(hover: hover)',
  '(pointer: fine)',
  '(any-hover: hover)',
  '(any-pointer: fine)',
]

/** Temp directory the runner owns. `E2E_TMPDIR` points at one writable parent. */
export const TEMP_BASE = process.env.E2E_TMPDIR?.trim() || path.join(process.cwd(), '.e2e-tmp')

/** Resolves the browser binary from `CHROME_PATH`. CI exports it before the run. */
export async function findChrome() {
  const explicit = process.env.CHROME_PATH?.trim()

  if (explicit === undefined || explicit === '') {
    throw new Error('Set CHROME_PATH to a Chrome or Chromium binary.')
  }

  const exists = await fs
    .stat(explicit)
    .then(() => true)
    .catch(() => false)

  if (!exists) {
    throw new Error(
      `No Chrome binary at ${explicit}. Set CHROME_PATH to a Chrome or Chromium binary.`,
    )
  }

  return explicit
}

async function readJson(url) {
  const response = await fetch(url)
  return response.json()
}

async function waitForJson(url, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      return await readJson(url)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
  }

  throw new Error(message)
}

/** Reads media queries on the page, keyed by query. */
export async function readMediaQueries(driver, queries = HOVER_QUERIES) {
  const entries = await driver.evaluate(
    `(${JSON.stringify(queries)}).map((query) => [query, matchMedia(query).matches])`,
  )

  return Object.fromEntries(entries)
}

function formatMediaQueries(media) {
  return Object.entries(media)
    .map(([query, matches]) => `${query}=${String(matches)}`)
    .join(' ')
}

/** Logs the pointer media features and fails when hover or a fine pointer is missing. */
export async function assertHoverMedia(driver) {
  const media = await readMediaQueries(driver)

  console.log(`# media ${formatMediaQueries(media)}`)

  if (!media['(hover: hover)'] || !media['(pointer: fine)']) {
    throw new Error(
      `Chrome reports no hover or fine pointer (${formatMediaQueries(media)}). Launch Chrome with ${HOVER_MEDIA_FLAGS}.`,
    )
  }
}

class CdpSocket {
  constructor(socket) {
    this.socket = socket
    this.nextId = 0
    this.pending = new Map()
    this.listeners = new Map()

    socket.addEventListener('message', (event) => {
      this.handle(JSON.parse(event.data))
    })
  }

  handle(message) {
    if (message.id !== undefined) {
      const entry = this.pending.get(message.id)

      if (entry !== undefined) {
        this.pending.delete(message.id)
        clearTimeout(entry.timer)
        entry.settle(message)
      }

      return
    }

    for (const listener of this.listeners.get(message.method) ?? []) {
      listener(message.params)
    }
  }

  on(method, listener) {
    const current = this.listeners.get(method) ?? []
    this.listeners.set(method, [...current, listener])

    return () => {
      this.listeners.set(
        method,
        (this.listeners.get(method) ?? []).filter((entry) => entry !== listener),
      )
    }
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = (this.nextId += 1)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, timeoutMs)

      this.pending.set(id, {
        timer,
        settle: (message) => {
          if (message.error !== undefined) {
            reject(new Error(`${method}: ${message.error.message}`))
            return
          }

          resolve(message.result)
        },
      })

      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket.close()
  }
}

const HELPER_SCRIPT = `
window.__e2e = {
  bySelector(selector) {
    return document.querySelector(selector)
  },
  all(selector) {
    return [...document.querySelectorAll(selector)]
  },
  text(selector) {
    return document.querySelector(selector)?.innerText ?? null
  },
  exists(selector) {
    return document.querySelector(selector) !== null
  },
  click(selector) {
    const element = document.querySelector(selector)
    if (element === null) return false
    element.click()
    return true
  },
  clickText(text) {
    const element = [...document.querySelectorAll('button, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"]')]
      .find((node) => node.innerText.trim() === text || node.getAttribute('aria-label') === text)
    if (element === undefined) return false
    element.click()
    return true
  },
  clickLabel(label) {
    const element = document.querySelector('[aria-label="' + label.replaceAll('"', '\\\\"') + '"]')
    if (element === null) return false
    element.click()
    return true
  },
  focus(selector) {
    const element = document.querySelector(selector)
    if (element === null) return false
    element.focus()
    return true
  },
  promptText(selector) {
    return document.querySelector(selector)?.innerText ?? ''
  },
  rect(selector) {
    const element = document.querySelector(selector)
    if (element === null) return null
    const r = element.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left }
  },
}

window.__cspViolations = []
addEventListener('securitypolicyviolation', (event) => {
  // CDP Runtime.evaluate counts as eval. The driver's own probes are not app code.
  if (event.blockedURI === 'eval') return
  window.__cspViolations.push({
    directive: event.violatedDirective,
    blockedURI: event.blockedURI,
    sourceFile: event.sourceFile,
    lineNumber: event.lineNumber,
  })
})
`

/** One attached page target with the driver helpers installed on every document. */
export class PageDriver {
  constructor(cdp) {
    this.cdp = cdp
  }

  static async attach(port) {
    const targets = await readJson(`http://127.0.0.1:${port}/json`)
    const target = targets.find((entry) => entry.type === 'page')

    if (target === undefined) {
      throw new Error('Chrome has no page target')
    }

    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })

    const driver = new PageDriver(new CdpSocket(socket))

    driver.targetId = target.id
    driver.port = port

    await driver.cdp.send('Page.enable')
    await driver.cdp.send('Runtime.enable')
    await driver.cdp.send('Network.enable')
    await driver.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: HELPER_SCRIPT,
    })

    return driver
  }

  on(method, listener) {
    return this.cdp.on(method, listener)
  }

  send(method, params) {
    return this.cdp.send(method, params)
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
  }

  async setSessionCookie(token) {
    await this.send('Network.setCookie', {
      name: 'upai_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    })
  }

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await this.waitFor(`document.readyState === 'complete'`, 30_000, `load ${url}`)
  }

  async evaluate(source, timeoutMs = 30_000) {
    const result = await this.send(
      'Runtime.evaluate',
      {
        expression: source,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
      timeoutMs,
    )

    if (result.exceptionDetails !== undefined) {
      const details = result.exceptionDetails
      throw new Error(details.exception?.description ?? details.text ?? 'evaluate failed')
    }

    return result.result.value
  }

  async waitFor(source, timeoutMs, message) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const value = await this.evaluate(source)

      if (value) {
        return value
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }

    throw new Error(`Timed out waiting for ${message}`)
  }

  /** Waits until no request has been in flight for `IDLE_QUIET_MS`. */
  async waitForIdle(timeoutMs = 15_000) {
    let pending = 0
    let activity = Date.now()

    const started = () => {
      pending += 1
      activity = Date.now()
    }

    const finished = () => {
      pending = Math.max(0, pending - 1)
      activity = Date.now()
    }

    const offStarted = this.on('Network.requestWillBeSent', started)
    const offFinished = this.on('Network.loadingFinished', finished)
    const offFailed = this.on('Network.loadingFailed', finished)

    try {
      const deadline = Date.now() + timeoutMs

      while (Date.now() < deadline) {
        if (pending === 0 && Date.now() - activity >= IDLE_QUIET_MS) {
          return
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      }

      throw new Error('Timed out waiting for network idle')
    } finally {
      offStarted()
      offFinished()
      offFailed()
    }
  }

  async click(selector) {
    const clicked = await this.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el === null) return false; el.click(); return true })()`,
    )

    if (!clicked) {
      throw new Error(`No element to click: ${selector}`)
    }
  }

  async clickText(text) {
    const clicked = await this.evaluate(`window.__e2e.clickText(${JSON.stringify(text)})`)

    if (!clicked) {
      throw new Error(`No button with text: ${text}`)
    }
  }

  async clickLabel(label) {
    const clicked = await this.evaluate(`window.__e2e.clickLabel(${JSON.stringify(label)})`)

    if (!clicked) {
      throw new Error(`No control labelled: ${label}`)
    }
  }

  async focus(selector) {
    const focused = await this.evaluate(`window.__e2e.focus(${JSON.stringify(selector)})`)

    if (!focused) {
      throw new Error(`No element to focus: ${selector}`)
    }
  }

  async type(text) {
    await this.send('Input.insertText', { text })
  }

  async typeInto(selector, text) {
    await this.focus(selector)
    await this.type(text)
  }

  async pressKey(key, code = key) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code })
  }

  async hover(selector) {
    const rect = await this.evaluate(`window.__e2e.rect(${JSON.stringify(selector)})`)

    if (rect === null) {
      throw new Error(`No element to hover: ${selector}`)
    }

    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height / 2

    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  }

  async mouseClick(selector) {
    const rect = await this.evaluate(`window.__e2e.rect(${JSON.stringify(selector)})`)

    if (rect === null) {
      throw new Error(`No element to click: ${selector}`)
    }

    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height / 2

    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true })
    await this.waitFor(`document.readyState === 'complete'`, 30_000, 'reload')
  }

  /** Saves a viewport screenshot under the e2e temp directory. */
  async captureScreenshot(name) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' })
    const file = path.join(TEMP_BASE, `${name}.png`)

    await fs.writeFile(file, Buffer.from(shot.data, 'base64'))

    return file
  }

  async close() {
    this.cdp.close()
  }
}

/** Launches Chrome, or attaches when `E2E_CDP_PORT` names a running browser. */
export async function startBrowser(width, height, options = {}) {
  const { mediaFlags = HOVER_MEDIA_FLAGS, forceLaunch = false } = options
  const attachedPort = process.env.E2E_CDP_PORT?.trim()

  if (!forceLaunch && attachedPort !== undefined && attachedPort !== '') {
    const port = Number(attachedPort)
    const version = await readJson(`http://127.0.0.1:${port}/json/version`)

    checkChromeMajor(version.Browser)

    const driver = await PageDriver.attach(port)
    await driver.setViewport(width, height)

    return { driver, process: null, attached: true, port }
  }

  const binary = await findChrome()
  const port = await freePort()
  const profile = await fs.mkdtemp(path.join(TEMP_BASE, 'chrome-'))
  const args = [
    '--headless',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    mediaFlags,
    `--remote-debugging-port=${String(port)}`,
    `--user-data-dir=${profile}`,
    `--window-size=${String(width)},${String(height)}`,
    'about:blank',
  ]
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  let stderr = ''

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
  })

  const version = await waitForJson(
    `http://127.0.0.1:${String(port)}/json/version`,
    20_000,
    `Chrome did not start: ${stderr}`,
  )

  checkChromeMajor(version.Browser)

  const driver = await PageDriver.attach(port)
  await driver.setViewport(width, height)

  return { driver, process: child, attached: false, port, profile }
}

export async function stopBrowser(browser) {
  if (browser.attached) {
    await browser.driver.close()
    return
  }

  try {
    const version = await readJson(`http://127.0.0.1:${String(browser.port)}/json/version`)
    const socket = new WebSocket(version.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    const cdp = new CdpSocket(socket)
    await cdp.send('Browser.close').catch(() => undefined)
  } catch {
    // The browser is already gone.
  }

  await browser.driver.close()
  browser.process?.kill('SIGTERM')

  if (browser.profile !== undefined) {
    await fs.rm(browser.profile, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Free loopback port for the app or the browser. */
export async function freePort() {
  const net = await import('node:net')
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))

  return port
}
