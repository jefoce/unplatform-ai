import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import { isNil } from 'lodash-es'

const configuredToken = process.env.APP_TOKEN?.trim() ?? ''
const TOKEN = configuredToken === '' ? null : configuredToken

export const SESSION_COOKIE = 'upai_session'

/** Desktop sets APP_TOKEN. Browser mode has no session check. */
export function sessionRequired(): boolean {
  return !isNil(TOKEN)
}

export function tokenMatches(value: string | null | undefined): boolean {
  if (isNil(TOKEN) || TOKEN === '' || isNil(value) || value === '') return false

  const a = Buffer.from(value)
  const b = Buffer.from(TOKEN)

  return a.length === b.length && timingSafeEqual(a, b)
}

/** Reads the session cookie. Missing or wrong values fail closed. */
export function hasSession(request: Request): boolean {
  if (isNil(TOKEN) || TOKEN === '') return true

  const cookie = request.headers.get('cookie') ?? ''
  const value = cookie
    .split(/;\s*/)
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1)

  return tokenMatches(value)
}
