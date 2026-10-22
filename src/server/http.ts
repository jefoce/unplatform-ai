import 'server-only'

import { isNil } from 'lodash-es'
import type { ZodError } from 'zod'

import { MEDIA_KINDS } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'

import { OpenRouterError } from './openrouter/client'
import { HttpError, ValidationError } from './request-guard'

export { assertLocalRequest, HttpError, readJsonBody } from './request-guard'

interface JsonErrorParams {
  status: number
  error: string
  details?: string[]
}

/** Builds a JSON error response, omitting empty details. */
export function jsonError(params: JsonErrorParams): Response {
  const { status, error, details } = params

  if (!isNil(details) && details.length > 0) return Response.json({ error, details }, { status })

  return Response.json({ error }, { status })
}

/** Maps known server errors to responses. Unknown errors are logged, never exposed. */
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonError({ status: error.status, error: error.message })

  if (error instanceof ValidationError)
    return jsonError({ status: 400, error: error.message, details: error.errors })

  if (error instanceof OpenRouterError)
    return jsonError({
      status: error.status === 0 || Number.isNaN(error.status) ? 502 : error.status,
      error: error.message,
    })

  console.error('[unplatform-ai] unhandled route error', error)

  return jsonError({ status: 500, error: 'Internal error' })
}

/** Formats zod issues as 400 details. */
export function zodError(error: ZodError): Response {
  const details = error.issues.map((issue) => {
    const field = issue.path.join('.')

    return `${field === '' ? 'body' : field}: ${issue.message}`
  })

  return jsonError({ status: 400, error: 'Invalid request', details })
}

/** Keeps known media kinds from a comma-separated query value. */
export function parseKinds(value: string | null): MediaKind[] {
  if (isNil(value) || value === '') return []

  const wanted = new Set(value.split(',').map((part) => part.trim()))

  return MEDIA_KINDS.filter((kind) => wanted.has(kind))
}
