import 'server-only'

import fsSync from 'node:fs'
import fs from 'node:fs/promises'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { LOCK_BOOT_GRACE_MS } from '@/core/constants'

import { LOCK_FILE, STORAGE_ROOT } from './paths'
import { bootNonce, desktopMode } from './session'

const LockInfoSchema = z.object({
  pid: z.number(),
  port: z.number(),
  desktop: z.boolean(),
  startedAt: z.string(),
  createdAt: z.string().optional(),
  bootNonce: z.string(),
})

const HealthReplySchema = z.object({
  app: z.string().optional(),
  bootNonce: z.string().optional(),
})

interface HealthProbe {
  hasReply: boolean
  isOwner: boolean
}

export type LockInfo = z.infer<typeof LockInfoSchema>

const HEALTH_TIMEOUT_MS = 1500

/** A lock may be mid-write by another boot, so an unparseable file gets one retry. */
const LOCK_RETRY_MS = 2000

/** Takes server.lock or exits. A dead owner's lock is taken over. */
export async function acquireInstanceLock(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true, mode: 0o700 })

  const now = new Date().toISOString()

  const mine: LockInfo = {
    pid: process.pid,
    port: Number(process.env.PORT ?? 3000),
    desktop: desktopMode(),
    startedAt: now,
    createdAt: now,
    bootNonce: bootNonce(),
  }

  let isRetried = false

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await tryTakeLock(mine)) {
      releaseOnExit()

      return
    }

    let owner = await readLock()

    if (isNil(owner) && !isRetried) {
      isRetried = true
      await delay(LOCK_RETRY_MS)
      owner = await readLock()
    }

    if (owner) {
      await refuseLiveOwner(owner)
    }

    await fs.unlink(LOCK_FILE).catch(() => {}) // stale: owner crashed or was killed
  }

  throw new Error('Could not take server.lock')
}

/** Exits when another live owner owns the lock. Returns when the lock is stale. */
async function refuseLiveOwner(owner: LockInfo): Promise<void> {
  if (owner.pid === process.pid || !isPidAlive(owner.pid)) {
    return
  }

  const health = await probeHealth(owner)

  if (health.isOwner) {
    const where = owner.desktop ? 'the Unplatform AI app' : `browser mode on port ${owner.port}`

    console.error(`[unplatform-ai] already running in ${where}. Quit it first.`)
    process.exit(75) // EX_TEMPFAIL, Rust reads this code
  }

  if (!health.hasReply && isYoungLock(owner)) {
    console.error('[unplatform-ai] already starting. Wait a moment.')
    process.exit(75)
  }
}

/** Writes a complete temp file, then links it into place. False when a lock exists. */
async function tryTakeLock(mine: LockInfo): Promise<boolean> {
  const temp = `${LOCK_FILE}.tmp-${process.pid}`

  try {
    await fs.writeFile(temp, JSON.stringify(mine), { mode: 0o600 })
    await fs.link(temp, LOCK_FILE)

    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }

    return false
  } finally {
    await fs.unlink(temp).catch(() => {})
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Removes the lock only when this process owns it. */
export function releaseInstanceLock(): void {
  try {
    const raw: unknown = JSON.parse(fsSync.readFileSync(LOCK_FILE, 'utf8'))
    const owner = LockInfoSchema.safeParse(raw)

    if (owner.success && owner.data.pid === process.pid) {
      fsSync.unlinkSync(LOCK_FILE)
    }
  } catch {
    // Missing or unreadable: nothing of ours to remove.
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)

    return true
  } catch {
    return false
  }
}

/** A live PID with a lock younger than the boot grace may still be starting. */
function isYoungLock(owner: LockInfo): boolean {
  const createdAt = Date.parse(owner.createdAt ?? owner.startedAt)

  return Date.now() - createdAt < LOCK_BOOT_GRACE_MS
}

/** Asks the owner's port. A reply from another boot still counts as a reply. */
async function probeHealth(owner: LockInfo): Promise<HealthProbe> {
  const res = await fetch(`http://127.0.0.1:${owner.port}/api/health`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  }).catch(() => {
    return null
  })

  const raw: unknown = await res?.json().catch(() => {
    return null
  })

  const body = HealthReplySchema.safeParse(raw)

  if (!body.success) {
    return { hasReply: false, isOwner: false }
  }

  return {
    hasReply: true,
    isOwner: body.data.app === 'unplatform-ai' && body.data.bootNonce === owner.bootNonce,
  }
}

async function readLock(): Promise<LockInfo | null> {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(LOCK_FILE, 'utf8'))
    const parsed = LockInfoSchema.safeParse(raw)

    if (!parsed.success) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}

function releaseOnExit(): void {
  process.once('exit', releaseInstanceLock)
}
