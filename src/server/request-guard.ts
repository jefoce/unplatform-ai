import 'server-only'

import { isNonEmptyString } from '@/core/guards'

import { HttpError, RequestBodyError } from './errors'
import { hasSession } from './session'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

interface LocalRequestOptions {
  session?: boolean
}

/** Rejects non-local hosts, cross-site writes, foreign origins and missing desktop sessions. */
export function assertLocalRequest(request: Request, opts: LocalRequestOptions = {}): void {
  const host = request.headers.get('host') ?? ''

  if (!LOCAL_HOSTS.has(host.replace(/:\d+$/, ''))) {
    throw new HttpError(403, 'Forbidden host')
  }

  if (isWrite(request)) {
    assertSameOrigin(request)
  }

  if (opts.session !== false && !hasSession(request)) {
    throw new HttpError(401, 'No session')
  }
}

function isWrite(request: Request): boolean {
  return request.method !== 'GET' && request.method !== 'HEAD'
}

function assertSameOrigin(request: Request): void {
  const site = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')

  if (isNonEmptyString(site) && site !== 'same-origin' && site !== 'none') {
    throw new HttpError(403, 'Cross-site request')
  }

  if (isNonEmptyString(origin) && !LOCAL_HOSTS.has(new URL(origin).hostname)) {
    throw new HttpError(403, 'Bad origin')
  }
}

/** Parses a JSON body, requiring an application/json content type. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) {
    throw new HttpError(415, 'JSON required')
  }

  try {
    return (await request.json()) as unknown
  } catch {
    throw new RequestBodyError()
  }
}
