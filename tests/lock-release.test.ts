import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let root = ''
let lockFile = ''

async function loadLock() {
  vi.resetModules()
  vi.stubEnv('STORAGE_ROOT', root)

  return import('@/server/instance-lock')
}

async function writeLock(pid: number): Promise<void> {
  await fs.writeFile(
    lockFile,
    JSON.stringify({ pid, port: 3000, desktop: false, startedAt: new Date().toISOString() }),
  )
}

const lockExists = (): Promise<boolean> =>
  fs.lstat(lockFile).then(
    () => true,
    () => false,
  )

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'upai-lock-release-'))
  lockFile = path.join(root, 'server.lock')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('releaseInstanceLock', () => {
  it('keeps a lock owned by another process', async () => {
    await writeLock(process.pid + 1)
    const { releaseInstanceLock } = await loadLock()

    releaseInstanceLock()

    expect(await lockExists()).toBe(true)
  })

  it('removes the lock owned by this process', async () => {
    await writeLock(process.pid)
    const { releaseInstanceLock } = await loadLock()

    releaseInstanceLock()

    expect(await lockExists()).toBe(false)
  })

  it('ignores a missing lock', async () => {
    const { releaseInstanceLock } = await loadLock()

    expect(() => releaseInstanceLock()).not.toThrow()
  })
})
