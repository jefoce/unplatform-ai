import { type NextRequest, NextResponse } from 'next/server'
import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { buildAppCsp } from '@/lib/csp'
import { desktopMode, hasSession } from '@/server/session'

const ALIAS_HOSTS = new Set(['localhost', '[::1]'])
const SESSION_PATHS = new Set(['/session', '/session/required', '/host-redirect'])

interface AliasRedirectParams {
  pathname: string
  host: string
}

interface AliasTargetParams {
  pathname: string
  search: string
  host: string
}

interface SessionGateParams {
  pathname: string
  isDesktop: boolean
  hasSession: boolean
}

function hostnameOf(host: string): string {
  return host.replace(/:\d+$/, '')
}

function portOf(host: string): string {
  return host.slice(hostnameOf(host).length)
}

/** True when a page on an alias host still needs the 127.0.0.1 cookie host. */
export function shouldAliasRedirect(params: AliasRedirectParams): boolean {
  const { pathname, host } = params

  if (pathname.startsWith('/api') || SESSION_PATHS.has(pathname)) {
    return false
  }

  if (!ALIAS_HOSTS.has(hostnameOf(host))) {
    return false
  }

  return isNonEmptyString(portOf(host))
}

/** Cookie-host target for an alias page request, with the query string intact. */
export function aliasRedirectUrl(params: AliasTargetParams): URL | null {
  const { pathname, search, host } = params

  if (!shouldAliasRedirect({ pathname, host })) {
    return null
  }

  return new URL(`${pathname}${search}`, `http://127.0.0.1${portOf(host)}`)
}

/** Next relativizes cross-loopback redirects, so a route answers with the absolute URL. */
function aliasRedirect(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host') ?? ''

  const target = aliasRedirectUrl({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    host,
  })

  if (isNil(target)) {
    return null
  }

  const route = new URL(`http://127.0.0.1${portOf(host)}/host-redirect`)

  route.searchParams.set('path', `${target.pathname}${target.search}`)

  return NextResponse.rewrite(route)
}

/** Browser pages without a valid cookie land on the printed-link page. */
function requiresSession(params: SessionGateParams): boolean {
  const { pathname, isDesktop, hasSession } = params

  if (isDesktop || SESSION_PATHS.has(pathname)) {
    return false
  }

  return !hasSession
}

/** Same host as the request, so a synthesized alias URL cannot bounce the browser. */
function sessionRequiredUrl(request: NextRequest): URL {
  const target = new URL('/session/required', request.url)
  const host = request.headers.get('host') ?? ''

  if (ALIAS_HOSTS.has(hostnameOf(target.host)) && isNonEmptyString(host)) {
    target.host = host
  }

  return target
}

/** One nonce per document, so Next can stamp every script tag it renders. */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isDesktop = desktopMode()
  const hasValidSession = hasSession(request)

  const redirect = aliasRedirect(request)

  if (!isNil(redirect)) {
    return redirect
  }

  if (requiresSession({ pathname, isDesktop, hasSession: hasValidSession })) {
    const response = NextResponse.redirect(sessionRequiredUrl(request))

    response.headers.set('cache-control', 'no-store')

    return response
  }

  const nonce = crypto.randomUUID()
  const csp = buildAppCsp(process.env.NODE_ENV !== 'production', nonce)
  const headers = new Headers(request.headers)
  const init = { request: { headers } }

  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)

  const response = NextResponse.next(init)

  response.headers.set('content-security-policy', csp)

  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
