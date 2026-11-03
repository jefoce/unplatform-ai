import 'server-only'

import { isNil } from 'lodash-es'

import { MAX_JSON_BODY_BYTES } from '@/core/constants'
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

  if (!isNonEmptyString(origin)) {
    return
  }

  const parsed = parseOrigin(origin)

  if (isNil(parsed) || parsed.protocol !== 'http:' || !LOCAL_HOSTS.has(parsed.hostname)) {
    throw new HttpError(403, 'Bad origin')
  }

  if (parsed.host !== (request.headers.get('host') ?? '')) {
    throw new HttpError(403, 'Bad origin')
  }
}

/** Malformed origins fail closed instead of throwing. */
function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin)
  } catch {
    return null
  }
}

/** Parses a JSON body, rejecting anything over MAX_JSON_BODY_BYTES. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.includes('application/json') !== true) {
    throw new HttpError(415, 'JSON required')
  }

  assertBodySize(request.headers.get('content-length'))

  const body = request.body

  if (isNil(body)) {
    throw new RequestBodyError()
  }

  const chunks: Buffer[] = []
  let total = 0
  const reader = body.getReader()

  for (;;) {
    const { done: isDone, value } = await reader.read()

    if (isDone) {
      break
    }

    total += value.byteLength

    if (total > MAX_JSON_BODY_BYTES) {
      await reader.cancel()

      throw new HttpError(413, 'Request body too large')
    }

    chunks.push(Buffer.from(value))
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new RequestBodyError()
  }
}

function assertBodySize(header: string | null): void {
  if (isNil(header)) {
    return
  }

  const size = Number(header)

  if (Number.isFinite(size) && size > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'Request body too large')
  }
}
