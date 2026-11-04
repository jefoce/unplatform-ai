import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TOKEN = 'a'.repeat(64)
const PARENT_SECRET = 'b'.repeat(64)
const BOOT_NONCE = 'c'.repeat(32)

interface LoadParams {
  token?: string
  sessionFile?: string
  storageRoot?: string
}

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'cf-session-root-'))
}

async function load(params: LoadParams = {}) {
  const { token = '', sessionFile = '', storageRoot = await tempRoot() } = params

  vi.resetModules()
  vi.stubEnv('APP_TOKEN', token)
  vi.stubEnv('APP_TOKEN_FILE', sessionFile)
  vi.stubEnv('UPAI_DESKTOP', '')
  vi.stubEnv('STORAGE_ROOT', storageRoot)
  vi.stubEnv('PORT', '3000')

  return import('@/server/session')
}

function browserFile(root: string): string {
  return path.join(root, 'browser-session')
}

function clearSessionGlobals(): void {
  for (const key of Object.keys(globalThis)) {
    if (key.startsWith('__upai_session:')) {
      Reflect.deleteProperty(globalThis, key)
    }
  }
}

interface SessionFile {
  token?: string
  parentSecret?: string
  bootNonce?: string
}

async function writeSession(data: SessionFile): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cf-session-'))
  const file = path.join(dir, 'session')

  await writeFile(file, JSON.stringify(data), { mode: 0o600 })

  return file
}

function makeRequest(cookie?: string): Request {
  const hasCookie = !isNil(cookie) && cookie !== ''

  return new Request('http://127.0.0.1:3000/', { headers: hasCookie ? { cookie } : {} })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session', () => {
  it('mints a browser token when none is passed', async () => {
    const { browserSessionUrl, desktopMode, hasSession } = await load()

    expect(desktopMode()).toBe(false)
    expect(hasSession(makeRequest())).toBe(false)
    expect(hasSession(makeRequest('upai_session=nope'))).toBe(false)

    expect(browserSessionUrl()).toMatch(/^http:\/\/127\.0\.0\.1:3000\/session#t=[0-9a-f]{64}$/)
  })

  it('requires a session when APP_TOKEN is set', async () => {
    const { browserSessionUrl, desktopMode, hasSession } = await load({ token: TOKEN })

    expect(desktopMode()).toBe(true)
    expect(browserSessionUrl()).toBeNull()
    expect(hasSession(makeRequest())).toBe(false)
  })

  it('rejects a wrong cookie and accepts the right one', async () => {
    const { hasSession } = await load({ token: TOKEN })

    expect(hasSession(makeRequest('upai_session=wrong'))).toBe(false)
    expect(hasSession(makeRequest(`other=1; upai_session=${TOKEN}`))).toBe(true)
  })

  it('rejects tokens of a different length', async () => {
    const { tokenMatches } = await load({ token: TOKEN })

    expect(tokenMatches('short')).toBe(false)
    expect(tokenMatches(null)).toBe(false)
    expect(tokenMatches(TOKEN)).toBe(true)
  })

  it('matches only the parent secret from the one-time file', async () => {
    const file = await writeSession({ token: TOKEN, parentSecret: PARENT_SECRET })
    const { parentSecretMatches } = await load({ sessionFile: file })

    expect(parentSecretMatches(PARENT_SECRET)).toBe(true)
    expect(parentSecretMatches('wrong')).toBe(false)
    expect(parentSecretMatches(null)).toBe(false)
  })

  it('ignores the parent secret environment variable', async () => {
    vi.stubEnv('PARENT_SECRET', PARENT_SECRET)
    const { parentSecretMatches } = await load({ token: TOKEN })

    expect(parentSecretMatches(PARENT_SECRET)).toBe(false)
  })

  it('rejects every parent secret when none is configured', async () => {
    const { parentSecretMatches } = await load({ token: TOKEN })

    expect(parentSecretMatches('')).toBe(false)
    expect(parentSecretMatches(PARENT_SECRET)).toBe(false)
  })

  it('reads the token, parent secret and boot nonce from the file once', async () => {
    const file = await writeSession({
      token: TOKEN,
      parentSecret: PARENT_SECRET,
      bootNonce: BOOT_NONCE,
    })

    const { bootNonce, hasSession, parentSecretMatches, desktopMode } = await load({
      sessionFile: file,
    })

    expect(desktopMode()).toBe(true)
    expect(hasSession(makeRequest(`upai_session=${TOKEN}`))).toBe(true)
    expect(parentSecretMatches(PARENT_SECRET)).toBe(true)
    expect(bootNonce()).toBe(BOOT_NONCE)
    await expect(stat(file)).rejects.toThrow()
  })

  it('fails closed when the session file cannot be read', async () => {
    const missing = path.join(os.tmpdir(), `cf-missing-${TOKEN}`)
    const { hasSession, desktopMode } = await load({ sessionFile: missing })

    expect(desktopMode()).toBe(true)
    expect(hasSession(makeRequest(`upai_session=${TOKEN}`))).toBe(false)
  })

  it('fails closed when the session file is malformed', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'cf-session-'))
    const file = path.join(dir, 'session')

    await writeFile(file, TOKEN)

    const { hasSession } = await load({ sessionFile: file })

    expect(hasSession(makeRequest(`upai_session=${TOKEN}`))).toBe(false)
  })
})

describe('browser session file', () => {
  it('mints and stores a browser token when the file is missing', async () => {
    const root = await tempRoot()
    const { browserSessionUrl } = await load({ storageRoot: root })
    const stored = await readFile(browserFile(root), 'utf8')

    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(browserSessionUrl()).toContain(`#t=${stored}`)

    const stats = await stat(browserFile(root))

    if (process.platform === 'win32') {
      expect(stats.isFile()).toBe(true)

      return
    }

    expect(stats.mode & 0o777).toBe(0o600)
  })

  it('reuses the stored browser token after a module reload', async () => {
    const root = await tempRoot()
    const first = await load({ storageRoot: root })
    const url = first.browserSessionUrl()

    clearSessionGlobals()

    const second = await load({ storageRoot: root })

    expect(second.browserSessionUrl()).toBe(url)
    expect(await readFile(browserFile(root), 'utf8')).toHaveLength(64)
  })

  it('never writes the browser session file in desktop mode', async () => {
    const root = await tempRoot()

    await load({ token: TOKEN, storageRoot: root })

    await expect(stat(browserFile(root))).rejects.toThrow()
  })
})

describe('session bundles', () => {
  it('shares the token across bundle instances', async () => {
    const file = await writeSession({
      token: TOKEN,
      parentSecret: PARENT_SECRET,
      bootNonce: BOOT_NONCE,
    })

    const first = await load({ sessionFile: file })

    expect(first.desktopMode()).toBe(true)

    vi.resetModules()

    const second = await import('@/server/session')

    expect(second.desktopMode()).toBe(true)
    expect(second.hasSession(makeRequest(`upai_session=${TOKEN}`))).toBe(true)
    expect(second.parentSecretMatches(PARENT_SECRET)).toBe(true)
    expect(second.bootNonce()).toBe(BOOT_NONCE)
  })
})
