import 'server-only'

import fsSync from 'node:fs'
import fs from 'node:fs/promises'

import { LOCK_FILE, STORAGE_ROOT } from './paths'
import { sessionRequired } from './session'

export interface LockInfo {
  pid: number
  port: number
  desktop: boolean
  startedAt: string
}

const HEALTH_TIMEOUT_MS = 1500

/** Takes server.lock or exits. A dead owner's lock is taken over. */
export async function acquireInstanceLock(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true, mode: 0o700 })
  const mine: LockInfo = {
    pid: process.pid,
    port: Number(process.env.PORT ?? 3000),
    desktop: sessionRequired(),
    startedAt: new Date().toISOString(),
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await fs.open(LOCK_FILE, 'wx')

      await handle.writeFile(JSON.stringify(mine))
      await handle.close()
      releaseOnExit()

      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }

    const owner = await readLock()

    if (owner && owner.pid !== process.pid && (await isAlive(owner))) {
      const where = owner.desktop ? 'the Unplatform AI app' : `browser mode on port ${owner.port}`

      console.error(`[unplatform-ai] already running in ${where}. Quit it first.`)
      process.exit(75) // EX_TEMPFAIL, Rust reads this code
    }

    await fs.unlink(LOCK_FILE).catch(() => {}) // stale: owner crashed or was killed
  }

  throw new Error('Could not take server.lock')
}

/** Removes the lock only when this process owns it. */
export function releaseInstanceLock(): void {
  try {
    const owner = JSON.parse(fsSync.readFileSync(LOCK_FILE, 'utf8')) as Partial<LockInfo>

    if (owner.pid === process.pid) fsSync.unlinkSync(LOCK_FILE)
  } catch {
    // Missing or unreadable: nothing of ours to remove.
  }
}

/** Alive = process exists and its port answers /api/health as unplatform-ai. */
async function isAlive(owner: LockInfo): Promise<boolean> {
  try {
    process.kill(owner.pid, 0)
  } catch {
    return false
  }

  const res = await fetch(`http://127.0.0.1:${owner.port}/api/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  }).catch(() => null)
  const body = (await res?.json().catch(() => null)) as { app?: string; pid?: number } | null

  return body?.app === 'unplatform-ai' && body.pid === owner.pid
}

async function readLock(): Promise<LockInfo | null> {
  try {
    return JSON.parse(await fs.readFile(LOCK_FILE, 'utf8')) as LockInfo
  } catch {
    return null
  }
}

function releaseOnExit(): void {
  process.once('exit', releaseInstanceLock)

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      releaseInstanceLock()
      process.exit(0)
    })
  }
}
