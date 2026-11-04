import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

interface BootModules {
  browserSessionUrl: () => string | null
  logBrowserSession: () => void
}

async function load(): Promise<BootModules> {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), 'cf-boot-session-'))

  vi.resetModules()
  vi.stubEnv('APP_TOKEN', '')
  vi.stubEnv('APP_TOKEN_FILE', '')
  vi.stubEnv('STORAGE_ROOT', storageRoot)
  vi.stubEnv('PORT', '3000')

  const { browserSessionUrl } = await import('@/server/session')
  const { logBrowserSession } = await import('@/server/boot')

  return { browserSessionUrl, logBrowserSession }
}

function recordLog(): string[] {
  const lines: string[] = []

  vi.spyOn(console, 'log').mockImplementation((...values: unknown[]) => {
    lines.push(values.map(String).join(' '))
  })

  return lines
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('boot session log', () => {
  it('prints the session url in browser mode', async () => {
    const { browserSessionUrl, logBrowserSession } = await load()
    const lines = recordLog()

    logBrowserSession()

    const url = browserSessionUrl()

    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/session#t=[0-9a-f]{64}$/)
    expect(lines).toEqual(['', `[unplatform-ai] open ${url}`, ''])
  })

  it('never prints the session token in desktop mode', async () => {
    vi.stubEnv('UPAI_DESKTOP', '1')
    const { browserSessionUrl, logBrowserSession } = await load()
    const lines = recordLog()

    logBrowserSession()

    expect(browserSessionUrl()).toBeNull()
    expect(lines).toEqual([])
  })
})
