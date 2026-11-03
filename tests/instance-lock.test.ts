/* eslint-disable max-lines-per-function -- the lock cases stay in one suite */

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
  vi.stubEnv('APP_TOKEN', 'cf-lock')
  vi.stubEnv('APP_TOKEN_FILE', '')

  return import('@/server/instance-lock')
}

async function writeLock(
  pid: number,
  port = 3000,
  bootNonce = 'owner-nonce',
  startedAt = new Date().toISOString(),
): Promise<void> {
  await fs.writeFile(lockFile, JSON.stringify({ pid, port, desktop: false, startedAt, bootNonce }))
}

async function readLockFile(): Promise<{ pid: number; bootNonce: string }> {
  return JSON.parse(await fs.readFile(lockFile, 'utf8')) as { pid: number; bootNonce: string }
}

async function readPid(): Promise<number> {
  const raw = JSON.parse(await fs.readFile(lockFile, 'utf8')) as { pid: number }

  return raw.pid
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-lock-'))
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

  it('refuses while a live owner is still starting', async () => {
    await writeLock(4242, 47821)
    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('no answer')
      }),
    )

    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)

    const { acquireInstanceLock } = await loadLock()

    await expect(acquireInstanceLock()).rejects.toThrow('exit 75')
    expect(exit).toHaveBeenCalledWith(75)
    expect(await readPid()).toBe(4242)
  })

  it('takes over a silent lock older than the boot grace', async () => {
    const startedAt = new Date(Date.now() - 120_000).toISOString()

    await writeLock(4242, 47821, 'owner-nonce', startedAt)
    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('no answer')
      }),
    )

    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()
    expect(await readPid()).toBe(process.pid)
  })

  it('takes over a malformed lock file after one retry', async () => {
    await fs.writeFile(lockFile, '{"pid":"nope"}')
    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()
    expect(await readPid()).toBe(process.pid)
  })

  it('leaves no temp file behind', async () => {
    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()

    expect(await fs.readdir(root)).toEqual(['server.lock'])
  })

  it('waits for a lock that is still being written', async () => {
    await fs.writeFile(lockFile, '{"pid":')

    const timer = setTimeout(() => {
      void writeLock(4242, 47821, 'owner-nonce')
    }, 100)

    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          json: async () => {
            return { app: APP, bootNonce: 'owner-nonce' }
          },
        }
      }),
    )

    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)

    const { acquireInstanceLock } = await loadLock()

    await expect(acquireInstanceLock()).rejects.toThrow('exit 75')
    expect(exit).toHaveBeenCalledWith(75)
    clearTimeout(timer)
  })

  it('exits with 75 when the owner answers health with the same nonce', async () => {
    await writeLock(4242, 47821, 'owner-nonce')
    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          json: async () => {
            return { app: APP, bootNonce: 'owner-nonce' }
          },
        }
      }),
    )

    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)

    const { acquireInstanceLock } = await loadLock()

    await expect(acquireInstanceLock()).rejects.toThrow('exit 75')
    expect(exit).toHaveBeenCalledWith(75)
  })

  it('refuses a second server on one storage root', async () => {
    const first = await loadLock()

    await first.acquireInstanceLock()

    const lock = await readLockFile()

    await writeLock(4242, 47821, lock.bootNonce)

    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          json: async () => {
            return { app: APP, bootNonce: lock.bootNonce }
          },
        }
      }),
    )

    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)

    const second = await loadLock()

    await expect(second.acquireInstanceLock()).rejects.toThrow('exit 75')
    expect(exit).toHaveBeenCalledWith(75)
    expect(await readPid()).toBe(4242)
  })

  it('takes over when health reports a different nonce', async () => {
    await writeLock(4242, 47821, 'owner-nonce')

    vi.spyOn(process, 'kill').mockReturnValue(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return {
          json: async () => {
            return { app: APP, bootNonce: 'someone-else' }
          },
        }
      }),
    )

    const { acquireInstanceLock } = await loadLock()

    await acquireInstanceLock()
    expect(await readPid()).toBe(process.pid)
  })
})
