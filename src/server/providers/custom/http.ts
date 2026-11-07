import 'server-only'

import { isNil } from 'lodash-es'

import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { Dict } from '@/core/utility-types'

import { getEndpointToken } from './endpoint-source'
import { networkError, protocolError, providerErrorFromResponse } from './errors'

/** Scheme, host and port only. A pasted `/upai` is dropped by rebuilding the URL. */
function endpointOrigin(endpoint: CustomEndpoint): string {
  return new URL(endpoint.baseUrl).origin
}

function endpointBaseUrl(endpoint: CustomEndpoint): string {
  return `${endpointOrigin(endpoint)}/upai`
}

export function endpointHostname(endpoint: CustomEndpoint): string {
  return new URL(endpoint.baseUrl).hostname
}

export function requestHeaders(endpoint: CustomEndpoint, isJson: boolean): Dict<string> {
  const headers: Dict<string> = {}
  const token = getEndpointToken(endpoint.id)

  if (!isNil(token)) {
    headers.Authorization = `Bearer ${token}`
  }

  if (isJson) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

export interface CustomRequestParams {
  endpoint: CustomEndpoint
  path: string
  init: RequestInit
  timeoutMs: number
}

/** Pinned to the endpoint origin, never follows a redirect. */
export async function customRequest(params: CustomRequestParams): Promise<Response> {
  const { endpoint, path, init, timeoutMs } = params
  const url = new URL(`${endpointBaseUrl(endpoint)}${path}`)

  if (url.origin !== endpointOrigin(endpoint)) {
    throw protocolError('Request outside the endpoint origin')
  }

  let res: Response

  try {
    res = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw networkError(error)
  }

  if (res.status >= 300 && res.status < 400) {
    if (!isNil(res.body)) {
      await res.body.cancel().catch(() => {})
    }

    throw protocolError('Endpoint redirect is not allowed')
  }

  return res
}

export async function requestJson(params: CustomRequestParams): Promise<unknown> {
  const res = await customRequest(params)

  if (!res.ok) {
    throw await providerErrorFromResponse(res)
  }

  return res.json().catch(() => {
    return null
  })
}
