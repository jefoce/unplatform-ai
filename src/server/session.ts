import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { isNonEmptyString } from '@/core/guards'

import { globalState } from './global-state'
import { STORAGE_ROOT } from './paths'

const BROWSER_SESSION_FILE = path.join(STORAGE_ROOT, 'browser-session')

const SessionFileSchema = z.object({
  token: z.string().optional(),
  parentSecret: z.string().optional(),
  bootNonce: z.string().optional(),
})

interface SessionState {
  token: string
  parentSecret: string
  bootNonce: string
  desktop: boolean
}

interface StoredSession {
  token: string
  parentSecret: string
  bootNonce: string
}

const envToken = process.env.APP_TOKEN?.trim() ?? ''
const envSessionFile = process.env.APP_TOKEN_FILE?.trim() ?? ''
const envDesktop = process.env.UPAI_DESKTOP === '1'

const state = globalState(
  `session:${cacheKey([envToken, envSessionFile, String(envDesktop), STORAGE_ROOT])}`,
  () => {
    return loadSession({ env: envToken, file: envSessionFile })
  },
)

export const SESSION_COOKIE = 'upai_session'

/** One process-wide slot, so every bundle instance sees the token read once. */
function cacheKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('\u0000')).digest('hex')
}

function randomToken(): string {
  return randomBytes(32).toString('hex')
}

function bootNonceOf(stored: string): string {
  if (isNonEmptyString(stored)) {
    return stored
  }

  return randomBytes(16).toString('hex')
}

interface LoadSessionParams {
  env: string
  file: string
}

/** Env token wins for dev and smoke runs. Browser mode reuses the stored file. */
function loadSession(params: LoadSessionParams): SessionState {
  const { env, file } = params
  const stored = readSessionFile(file)
  const hasEnvToken = isNonEmptyString(env)
  const isDesktop = hasEnvToken || isNonEmptyString(file) || envDesktop
  const token = sessionToken({ env, isDesktop, stored })
  const bootNonce = bootNonceOf(stored.bootNonce)

  return {
    token,
    parentSecret: stored.parentSecret,
    bootNonce,
    desktop: isDesktop,
  }
}

interface SessionTokenParams {
  env: string
  isDesktop: boolean
  stored: StoredSession
}

function sessionToken(params: SessionTokenParams): string {
  const { env, isDesktop, stored } = params

  if (isNonEmptyString(env)) {
    return env
  }

  if (isDesktop) {
    if (isNonEmptyString(stored.token)) {
      return stored.token
    }

    return randomToken()
  }

  return browserToken()
}

/** Browser token survives restarts, so an open tab keeps its cookie. */
function browserToken(): string {
  const stored = readBrowserToken()

  if (isNonEmptyString(stored)) {
    return stored
  }

  const token = randomToken()

  writeBrowserToken(token)

  return token
}

function readBrowserToken(): string {
  try {
    return readFileSync(BROWSER_SESSION_FILE, 'utf8').trim()
  } catch {
    return ''
  }
}

function writeBrowserToken(token: string): void {
  mkdirSync(STORAGE_ROOT, { recursive: true, mode: 0o700 })
  writeFileSync(BROWSER_SESSION_FILE, token, { mode: 0o600 })
  chmodSync(BROWSER_SESSION_FILE, 0o600)
}

/** Reads the desktop session file once, then deletes it. Empty means fail closed. */
function readSessionFile(file: string): StoredSession {
  if (!isNonEmptyString(file)) {
    return { token: '', parentSecret: '', bootNonce: '' }
  }

  try {
    const text = readFileSync(file, 'utf8')

    rmSync(file, { force: true })

    const raw: unknown = JSON.parse(text)
    const parsed = SessionFileSchema.safeParse(raw)

    if (!parsed.success) {
      return { token: '', parentSecret: '', bootNonce: '' }
    }

    return {
      token: parsed.data.token ?? '',
      parentSecret: parsed.data.parentSecret ?? '',
      bootNonce: parsed.data.bootNonce ?? '',
    }
  } catch {
    rmSync(file, { force: true })

    return { token: '', parentSecret: '', bootNonce: '' }
  }
}

/** True when the desktop shell supplied the token or set the desktop flag. */
export function desktopMode(): boolean {
  return envDesktop || state.desktop
}

/** Browser mode prints this once. Desktop passes the token through the shell. */
export function browserSessionUrl(): string | null {
  if (desktopMode()) {
    return null
  }

  let port = '3000'

  if (isNonEmptyString(process.env.PORT)) {
    port = process.env.PORT
  }

  return `http://127.0.0.1:${port}/session#t=${state.token}`
}

/** True when the desktop shell started this sidecar with its parent secret. */
export function isDesktopMode(): boolean {
  return isNonEmptyString(state.parentSecret)
}

/** Public instance id, safe to return from health. */
export function bootNonce(): string {
  return state.bootNonce
}

export function tokenMatches(value: string | null | undefined): boolean {
  if (!isNonEmptyString(value)) {
    return false
  }

  const a = Buffer.from(value)
  const b = Buffer.from(state.token)

  return a.length === b.length && timingSafeEqual(a, b)
}

/** True for the secret the desktop parent sends on its own calls. */
export function parentSecretMatches(value: string | null | undefined): boolean {
  if (!isNonEmptyString(state.parentSecret) || !isNonEmptyString(value)) {
    return false
  }

  const a = Buffer.from(value)
  const b = Buffer.from(state.parentSecret)

  return a.length === b.length && timingSafeEqual(a, b)
}

/** Reads the session cookie. Missing or wrong values fail closed. */
export function hasSession(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''

  const value = cookie
    .split(/;\s*/)
    .find((part) => {
      return part.startsWith(`${SESSION_COOKIE}=`)
    })
    ?.slice(SESSION_COOKIE.length + 1)

  return tokenMatches(value)
}
