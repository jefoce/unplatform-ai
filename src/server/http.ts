import 'server-only'

import { isNil } from 'lodash-es'
import type { ZodError } from 'zod'

import { isNonEmptyString } from '@/core/guards'
import { MEDIA_KINDS, type MediaKind } from '@/core/media/media-types'

import { HttpError, ValidationError } from './errors'
import { ProviderError } from './providers/provider-error'

interface IdParams {
  id: string
}

export interface IdRouteContext {
  params: Promise<IdParams>
}

interface PathParams {
  ref: string[]
}

export interface PathRouteContext {
  params: Promise<PathParams>
}

interface KeyParams {
  key: string[]
}

export interface KeyRouteContext {
  params: Promise<KeyParams>
}

interface JsonErrorParams {
  status: number
  error: string
  details?: string[]
}

/** JSON response for API data. Never stored by a browser or proxy. */
export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const response = Response.json(data, init)

  response.headers.set('Cache-Control', 'no-store')

  return response
}

/** Builds a JSON error response, omitting empty details. */
export function jsonError(params: JsonErrorParams): Response {
  const { status, error, details } = params

  if (!isNil(details) && details.length > 0) {
    return jsonResponse({ error, details }, { status })
  }

  return jsonResponse({ error }, { status })
}

/** Maps known server errors to responses. Unknown errors are logged, never exposed. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonError({ status: error.status, error: error.message })
  }

  if (error instanceof ValidationError) {
    return jsonError({ status: 400, error: error.message, details: error.errors })
  }

  if (error instanceof ProviderError) {
    const isStatusInvalid = error.status === 0 || Number.isNaN(error.status)
    const status = isStatusInvalid ? 502 : error.status

    return jsonError({ status, error: error.message })
  }

  console.error('[unplatform-ai] unhandled route error', error)

  return jsonError({ status: 500, error: 'Internal error' })
}

/** Formats zod issues as 400 details. */
export function zodError(error: ZodError): Response {
  const details = error.issues.map((issue) => {
    const field = issue.path.join('.')
    const fieldName = field === '' ? 'body' : field

    return `${fieldName}: ${issue.message}`
  })

  return jsonError({ status: 400, error: 'Invalid request', details })
}

/** Keeps known media kinds from a comma-separated query value. */
export function parseKinds(value: string | null): MediaKind[] {
  if (!isNonEmptyString(value)) {
    return []
  }

  const wanted = new Set(
    value.split(',').map((part) => {
      return part.trim()
    }),
  )

  return MEDIA_KINDS.filter((kind) => {
    return wanted.has(kind)
  })
}
