#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BYPASS_VAR = 'UNPLATFORM_DESKTOP_BUILD'
const SIGNAL_CODES = { SIGINT: 130, SIGTERM: 143 }

export const LOCK_PATH = path.join(ROOT, '.desktop-build.lock')

/**
 * True when this process runs under the desktop build that already holds the lock.
 */
function isInsideDesktopBuild() {
  return process.env[BYPASS_VAR] === '1'
}

/**
 * Lock entry at `file`, or null when it is missing or unreadable.
 */
function readLock(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))

    return { pid: parsed.pid, startedAt: parsed.startedAt }
  } catch {
    return null
  }
}

/**
 * A pid counts as alive unless the OS reports it gone.
 */
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false

  try {
    process.kill(pid, 0)

    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function describeLock(lock) {
  return `pid ${lock.pid}, started ${lock.startedAt}`
}

function busyMessage(lock) {
  return (
    `Desktop build in progress (${describeLock(lock)}). ` +
    'Run pnpm build, pnpm desktop:build and tauri build one at a time.'
  )
}

/**
 * Throws while a live process holds the lock. A dead holder is removed.
 */
export function assertFree(file = LOCK_PATH) {
  if (isInsideDesktopBuild()) return

  const lock = readLock(file)
  if (!lock) return
  if (isAlive(lock.pid)) throw new Error(busyMessage(lock))

  fs.rmSync(file, { force: true })
}

/**
 * Takes the lock for this process. Returns false when an outer desktop build owns it.
 */
export function acquire(file = LOCK_PATH) {
  if (isInsideDesktopBuild()) return false

  assertFree(file)

  const entry = { pid: process.pid, startedAt: new Date().toISOString() }

  try {
    fs.writeFileSync(file, `${JSON.stringify(entry)}\n`, { flag: 'wx' })
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(
        `Desktop build lock appeared at ${file}. Another build started at the same time.`,
      )
    }
    throw error
  }

  return true
}

/**
 * Removes the lock when this process owns it. Other holders and stale files stay.
 */
export function release(file = LOCK_PATH) {
  const lock = readLock(file)
  if (!lock || lock.pid !== process.pid) return

  fs.rmSync(file, { force: true })
}

/**
 * Runs `command` with the lock held and the bypass set for every descendant.
 */
async function runLocked(command, commandArgs) {
  acquire()

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, [BYPASS_VAR]: '1' },
  })

  process.once('exit', () => {
    release()
  })

  for (const [signal, code] of Object.entries(SIGNAL_CODES)) {
    process.once(signal, () => {
      if (isAlive(child.pid)) child.kill(signal)
      release()
      process.exit(code)
    })
  }

  const code = await new Promise((resolve, reject) => {
    child.once('close', resolve)
    child.once('error', reject)
  })

  process.exitCode = code ?? 1
}

/**
 * Runs the command after `node scripts/build-lock.mjs`, then sets the exit code.
 */
function runCli() {
  const [command, ...commandArgs] = process.argv.slice(2)

  if (!command) {
    console.error('[build-lock] usage: node scripts/build-lock.mjs <command> [args...]')
    process.exitCode = 1

    return
  }

  runLocked(command, commandArgs).catch((error) => {
    console.error(`[build-lock] ${error.message}`)
    process.exitCode = 1
  })
}

const entry = process.argv[1]

if (entry && import.meta.url === pathToFileURL(entry).href) {
  runCli()
}
