import { isUndefined } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'

interface ApiErrorParams {
  status: number
  message: string
  details?: string[]
}

/** Thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number
  readonly details?: string[]

  constructor(params: ApiErrorParams) {
    const { status, message, details } = params

    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface ErrorBody {
  error?: string
  details?: string[]
}

async function throwApiError(response: Response): Promise<never> {
  const body = (await response.json().catch(() => {
    return null
  })) as ErrorBody | null

  throw new ApiError({
    status: response.status,
    message: body?.error ?? response.statusText ?? `Request failed (${response.status})`,
    details: body?.details,
  })
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()

  if (text === '') {
    return undefined as T
  }

  // Own API, typed by the shared core shape, not validated.
  const parsed: unknown = JSON.parse(text)

  return parsed as T
}

/** SWR fetcher: GET with same-origin credentials. */
export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET', credentials: 'same-origin' })

  if (!response.ok) {
    return throwApiError(response)
  }

  return readJson<T>(response)
}

/** JSON request helper. Adds JSON headers unless the body is FormData. */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const body = init?.body
  const isForm = body instanceof FormData

  if (isNonEmptyString(body) && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { credentials: 'same-origin', ...init, headers })

  if (!response.ok) {
    return throwApiError(response)
  }

  return readJson<T>(response)
}

function bodyValue(body: unknown): string | undefined {
  if (isUndefined(body)) {
    return undefined
  }

  return JSON.stringify(body)
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: bodyValue(body),
  })
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'PATCH',
    body: bodyValue(body),
  })
}

export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: 'DELETE',
    body: bodyValue(body),
  })
}
