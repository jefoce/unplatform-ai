import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const APP = 'unplatform-ai'
let root = ''
let lockFile = ''

async function loadLock() {
  vi.resetModules()
  vi.stubEnv('STORAGE_ROOT', root)

  return import('@/server/instance-lock')
}

async function writeLock(pid: number, port = 3000): Promise<void> {
  await fs.writeFile(
    lockFile,
    JSON.stringify({ pid, port, desktop: false, startedAt: new Date().toISOString() }),
  )
}

async function readPid(): Promise<number> {
  const raw = JSON.parse(await fs.readFile(lockFile, 'utf8')) as { pid: number }

  return raw.pid
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-lock-'))
  lockFile = path.join(root, 'server.lock')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('acquireInstanceLock', () => {
  it('takes a free lock', async () => {
    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()
    expect(await readPid()).toBe(process.pid)
  })

  it('takes over a lock held by a dead pid', async () => {
    await writeLock(2_000_000)
    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()
    expect(await readPid()).toBe(process.pid)
  })

  it('exits with 75 when the owner answers health', async () => {
    await writeLock(4242, 47821)
    vi.spyOn(process, 'kill').mockReturnValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ app: APP, pid: 4242 }) })),
    )
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)

    const { acquireInstanceLock } = await loadLock()

    await expect(acquireInstanceLock()).rejects.toThrow('exit 75')
    expect(exit).toHaveBeenCalledWith(75)
  })
})
