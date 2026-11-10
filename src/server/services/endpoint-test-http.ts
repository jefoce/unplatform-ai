import 'server-only'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'

import { FETCH_TIMEOUTS, MAX_JSON_BODY_BYTES } from '@/core/constants'
import type { EndpointHealthStatus } from '@/core/endpoints'
import {
  CUSTOM_FORBIDDEN_MESSAGE,
  CUSTOM_OFFLINE_MESSAGE,
  CUSTOM_PROTOCOL_MESSAGE,
  CUSTOM_TOKEN_MESSAGE,
} from '@/core/providers/custom-messages'

import { BodyTooLargeError, readCappedBody } from '../media/read-capped-body'

interface FetchJsonParams<T> {
  url: string
  token: string | null
  schema: ZodType<T>
}

export interface TestFailure {
  status: EndpointHealthStatus
  message: string
}

class EndpointTestError extends Error {
  readonly status: EndpointHealthStatus

  constructor(params: TestFailure) {
    super(params.message)
    this.name = 'EndpointTestError'
    this.status = params.status
  }
}

export async function fetchJson<T>(params: FetchJsonParams<T>): Promise<T> {
  const headers: Record<string, string> = {}

  if (!isNil(params.token) && params.token !== '') {
    headers.Authorization = `Bearer ${params.token}`
  }

  let response: Response

  try {
    response = await fetch(params.url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })
  } catch {
    throw new EndpointTestError({ status: 'unreachable', message: CUSTOM_OFFLINE_MESSAGE })
  }

  if (response.status === 401) {
    throw new EndpointTestError({ status: 'unauthorized', message: CUSTOM_TOKEN_MESSAGE })
  }

  if (response.status === 403) {
    throw new EndpointTestError({ status: 'forbidden', message: CUSTOM_FORBIDDEN_MESSAGE })
  }

  if (!response.ok) {
    throw new EndpointTestError({
      status: 'unreachable',
      message: `ComfyUI answered ${response.status}`,
    })
  }

  const value = await readTestJson(response)
  const parsed = params.schema.safeParse(value)

  if (!parsed.success) {
    throw new EndpointTestError({ status: 'protocol', message: CUSTOM_PROTOCOL_MESSAGE })
  }

  return parsed.data
}

/** Reads a capped test body. Too large fails as a protocol answer, never as a hang. */
async function readTestJson(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length')

  if (!isNil(declared) && Number(declared) > MAX_JSON_BODY_BYTES) {
    await response.body?.cancel()

    throw new EndpointTestError({ status: 'protocol', message: CUSTOM_PROTOCOL_MESSAGE })
  }

  try {
    const body = await readCappedBody(response, MAX_JSON_BODY_BYTES)

    return JSON.parse(body.toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new EndpointTestError({ status: 'protocol', message: CUSTOM_PROTOCOL_MESSAGE })
    }

    return null
  }
}

export function testFailure(error: unknown): TestFailure {
  if (error instanceof EndpointTestError) {
    return { status: error.status, message: error.message }
  }

  return { status: 'unreachable', message: CUSTOM_OFFLINE_MESSAGE }
}
