import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { freePort, TEMP_BASE } from './cdp.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const OUTBOUND_GUARD = path.resolve(import.meta.dirname, 'outbound-guard.cjs')
const TOKEN = 'e2e-session'
const HEALTH_TIMEOUT_MS = 60_000
const RECORD_TIMEOUT_MS = 90_000
const POLL_MS = 250

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ffmpegPath() {
  const configured = process.env.FFMPEG_PATH?.trim()

  if (configured !== undefined && configured !== '') {
    return configured
  }

  const found = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' })
  const binary = found.status === 0 ? found.stdout.trim() : ''

  if (binary === '') {
    throw new Error('No ffmpeg found. Set FFMPEG_PATH to an ffmpeg binary.')
  }

  return binary
}

/** Builds the production app unless `E2E_SKIP_BUILD=1` says CI already did. */
export async function buildApp() {
  if (process.env.E2E_SKIP_BUILD?.trim() === '1') {
    return
  }

  await new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`pnpm build exited ${String(code)}`))
    })
  })
}

const SESSION_URL_PATTERN =
  /\[unplatform-ai\] open (http:\/\/127\.0\.0\.1:\d+\/session#t=[0-9a-f]{64})/

function printedSessionUrl(logs) {
  const found = logs.join('').match(SESSION_URL_PATTERN)

  if (found === null) {
    throw new Error(`Server printed no session URL:\n${logs.join('')}`)
  }

  return found[1]
}

/** One isolated app server on a free port with mock providers and a temp store. */
export async function startServer(options = {}) {
  const { browserMode = false, storageRoot: existingRoot } = options
  await fs.mkdir(TEMP_BASE, { recursive: true })

  const storageRoot = existingRoot ?? (await fs.mkdtemp(path.join(TEMP_BASE, 'storage-')))
  const port = await freePort()
  const ffmpeg = ffmpegPath()
  const env = { ...process.env }

  for (const name of Object.keys(env)) {
    if (
      name.startsWith('OPENROUTER_') ||
      name.startsWith('R2_') ||
      name === 'REMOTE_MOCK' ||
      name === 'CUSTOM_ENDPOINT_MOCK'
    ) {
      delete env[name]
    }
  }

  const nodeOptions = [env.NODE_OPTIONS?.trim(), `--require ${OUTBOUND_GUARD}`]
    .filter((part) => part !== undefined && part !== '')
    .join(' ')

  Object.assign(env, {
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    STORAGE_ROOT: storageRoot,
    OPENROUTER_MOCK: '1',
    REMOTE_MOCK: '1',
    CUSTOM_ENDPOINT_MOCK: '1',
    E2E: '1',
    NODE_ENV: 'production',
    FFMPEG_PATH: ffmpeg,
    NODE_OPTIONS: nodeOptions,
  })

  if (browserMode) {
    delete env.APP_TOKEN
    delete env.APP_TOKEN_FILE
    delete env.UPAI_DESKTOP
  } else {
    env.APP_TOKEN = TOKEN
  }

  const child = spawn('pnpm', ['start'], {
    cwd: ROOT,
    env,
    detached: process.platform !== 'win32',
    // pnpm is a .cmd shim on Windows, which needs a shell to launch.
    shell: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const logs = []
  let stdoutBuffer = ''

  child.stdout.on('data', (chunk) => {
    const text = String(chunk)
    stdoutBuffer += text
    logs.push(text)

    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const marker = line.match(/^@@upai-secrets (\{.*\})$/)

      if (marker !== null) {
        const message = JSON.parse(marker[1])
        child.stdin.write(`${JSON.stringify({ id: message.id, ok: true, value: '{}' })}\n`)
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    logs.push(String(chunk))
  })

  const baseUrl = `http://127.0.0.1:${String(port)}`
  let sessionToken = TOKEN

  const api = async (route, init = {}) => {
    const headers = {
      cookie: `upai_session=${sessionToken}`,
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    }
    const response = await fetch(`${baseUrl}${route}`, { ...init, headers })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`${init.method ?? 'GET'} ${route}: ${String(response.status)} ${text}`)
    }

    return response.json()
  }

  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  let isReady = false

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)

      if (response.ok) {
        isReady = true
        break
      }
    } catch {
      // Still booting.
    }

    await sleep(POLL_MS)
  }

  if (!isReady) {
    child.kill('SIGKILL')
    throw new Error(`Server did not become ready:\n${logs.join('')}`)
  }

  const sessionUrl = browserMode ? printedSessionUrl(logs) : `${baseUrl}/session#t=${TOKEN}`

  if (browserMode) {
    sessionToken = sessionUrl.split('#t=')[1] ?? TOKEN
  }

  const stop = async () => {
    if (child.exitCode !== null) {
      return
    }

    try {
      if (process.platform === 'win32') {
        child.kill('SIGTERM')
      } else {
        process.kill(-child.pid, 'SIGTERM')
      }
    } catch (error) {
      if (error.code !== 'ESRCH') {
        throw error
      }
    }

    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false)
      }, 10_000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve(true)
      })
    })

    if (!exited) {
      try {
        if (process.platform === 'win32') {
          child.kill('SIGKILL')
        } else {
          process.kill(-child.pid, 'SIGKILL')
        }
      } catch (error) {
        if (error.code !== 'ESRCH') {
          throw error
        }
      }
    }
  }

  return { baseUrl, port, storageRoot, logs, api, stop, token: sessionToken, sessionUrl }
}

/** Polls the record route until `predicate` accepts the record with `id`. */
export async function waitRecord(server, route, id, predicate, label) {
  const deadline = Date.now() + RECORD_TIMEOUT_MS

  while (Date.now() < deadline) {
    const result = await server.api(`${route}?ids=${id}`)
    const [record] = result.items

    if (record !== undefined && predicate(record)) {
      return record
    }

    await sleep(POLL_MS)
  }

  throw new Error(`Timed out waiting for ${label} ${id}`)
}

function imageBody(prompt, extra = {}) {
  return {
    presetId: 'gemini-3.1-flash-image',
    prompt,
    count: 1,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
    references: [],
    seed: null,
    ...extra,
  }
}

function videoBody(prompt, extra = {}) {
  return {
    presetId: 'wan-3.0',
    tab: 'references',
    prompt,
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '480p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
    ...extra,
  }
}

/** Creates an image record without waiting for it to finish. */
export async function createImageRecord(server, prompt) {
  return server.api('/api/images', {
    method: 'POST',
    body: JSON.stringify(imageBody(prompt)),
  })
}

/** Saved image record, created through the real submit route and polled to `saved`. */
export async function seedImage(server, prompt, extra) {
  const created = await server.api('/api/images', {
    method: 'POST',
    body: JSON.stringify(imageBody(prompt, extra)),
  })

  return waitRecord(
    server,
    '/api/images',
    created.id,
    (record) => {
      return record.status === 'completed' && record.outputs.length > 0
    },
    'saved image',
  )
}

/** Failed image record, using the mock provider's `[fail]` prompt. */
export async function seedFailedImage(server, prompt) {
  const created = await server.api('/api/images', {
    method: 'POST',
    body: JSON.stringify(imageBody(`[fail] ${prompt}`)),
  })

  return waitRecord(
    server,
    '/api/images',
    created.id,
    (record) => {
      return record.outputs.some((output) => {
        return output.status === 'failed'
      })
    },
    'failed image',
  )
}

/** Completed video record, created through the real submit route and polled. */
export async function seedVideo(server, prompt, extra) {
  const created = await server.api('/api/generations', {
    method: 'POST',
    body: JSON.stringify(videoBody(prompt, extra)),
  })

  return waitRecord(
    server,
    '/api/generations',
    created.id,
    (record) => {
      return record.status === 'completed'
    },
    'completed video',
  )
}

/** Failed video record, using the mock provider's `[fail]` prompt. */
export async function seedFailedVideo(server, prompt) {
  const created = await server.api('/api/generations', {
    method: 'POST',
    body: JSON.stringify(videoBody(`[fail] ${prompt}`, { resolution: '480p' })),
  })

  return waitRecord(
    server,
    '/api/generations',
    created.id,
    (record) => {
      return record.status === 'failed'
    },
    'failed video',
  )
}
