import 'server-only'

import { createHash } from 'node:crypto'

import { isNil, isUndefined } from 'lodash-es'
import type { ZodType } from 'zod'

import type { EndpointTestBody, EndpointTestResult } from '@/core/api/endpoints'
import { FETCH_TIMEOUTS, MAX_JSON_BODY_BYTES } from '@/core/constants'
import type { EndpointHealthStatus } from '@/core/endpoints'
import { UpaiHealthSchema, UpaiModelListSchema } from '@/core/protocol/upai'
import type { CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'

import { isCustomEndpointMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { BodyTooLargeError, readCappedBody } from '../media/read-capped-body'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { resetCustomProviders } from '../providers/registry'
import { normalizeBaseUrl } from '../repos/endpoints'
import { secretsReady } from '../secrets'
import { setEndpointHealth } from './endpoint-health'
import { writeEndpointModels } from './endpoint-model-cache'
import { lastHealthOf, mockTestResult } from './endpoint-test-mock'
import { readEndpointToken } from './endpoint-tokens'
import { clearModelCatalog } from './model-catalog'

const UNAUTHORIZED_TEXT = 'Token needed or wrong'

const FORBIDDEN_TEXT =
  'This computer cannot reach ComfyUI: enable LAN access in ComfyUI Settings > Unplatform AI, or add a token'

const OFFLINE_TEXT = 'Start ComfyUI, then test again'

const PROTOCOL_TEXT = 'This server does not speak upai/1'

export interface LastTestParams {
  baseUrl: string
  token: string | null
}

const testCache = globalState<Map<string, CustomEndpointLastHealth>>('endpointTestHealth', () => {
  return new Map()
})

function testKey(params: LastTestParams): string {
  const { baseUrl, token } = params

  const hash = createHash('sha256')
    .update(token ?? '')
    .digest('hex')

  return `${normalizeBaseUrl(baseUrl)}\n${hash}`
}

/** Latest successful test for one normalized URL and token. Server-owned. */
export function lastTestFor(params: LastTestParams): CustomEndpointLastHealth | null {
  return testCache.get(testKey(params)) ?? null
}

export function forgetLastTest(params: LastTestParams): void {
  testCache.delete(testKey(params))
}

export function __resetEndpointTestsForTests(): void {
  testCache.clear()
}

interface FetchJsonParams<T> {
  url: string
  token: string | null
  schema: ZodType<T>
}

interface TestFailure {
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

function isSavedUrl(params: EndpointTestBody, baseUrl: string): boolean {
  if (isNil(params.endpointId)) {
    return true
  }

  if (getEndpointSync(params.endpointId)?.baseUrl !== baseUrl) {
    return false
  }

  if (!isUndefined(params.token)) {
    return params.token === readEndpointToken(params.endpointId)
  }

  return true
}

export async function testEndpoint(params: EndpointTestBody): Promise<EndpointTestResult> {
  await secretsReady()

  if (
    isCustomEndpointMockMode() &&
    !isNil(params.endpointId) &&
    !isNil(getEndpointSync(params.endpointId))
  ) {
    return mockTestResult(params.endpointId)
  }

  const baseUrl = normalizeBaseUrl(params.baseUrl)
  const isSavedEndpoint = isSavedUrl(params, baseUrl)
  const token = resolveToken(params, isSavedEndpoint)
  const checkedAt = new Date().toISOString()

  try {
    const health = await fetchJson({
      url: `${baseUrl}/upai/api/v1/health`,
      token,
      schema: UpaiHealthSchema,
    })

    const [video, image] = await Promise.all([
      fetchJson({
        url: `${baseUrl}/upai/api/v1/videos/models`,
        token,
        schema: UpaiModelListSchema,
      }),
      fetchJson({
        url: `${baseUrl}/upai/api/v1/images/models`,
        token,
        schema: UpaiModelListSchema,
      }),
    ])

    if (isSavedEndpoint && !isNil(params.endpointId)) {
      setEndpointHealth({
        endpointId: params.endpointId,
        status: 'ok',
        message: null,
        maxRunning: health.max_running,
      })

      await writeEndpointModels({
        endpointId: params.endpointId,
        kind: 'video',
        models: video.data,
      })

      await writeEndpointModels({
        endpointId: params.endpointId,
        kind: 'image',
        models: image.data,
      })

      clearModelCatalog()
      resetCustomProviders()
    }

    const lastHealth = lastHealthOf(health, checkedAt)

    testCache.set(testKey({ baseUrl, token }), lastHealth)

    return {
      ok: true,
      error: null,
      serverVersion: health.server_version,
      videoCount: video.data.length,
      imageCount: image.data.length,
      authRequired: health.auth_required,
      lanAllowed: health.lan_allowed,
      instanceId: instanceIdOf(health.instance_id),
      lastHealth,
    }
  } catch (error) {
    const failure = testFailure(error)

    forgetLastTest({ baseUrl, token })

    if (isSavedEndpoint && !isNil(params.endpointId)) {
      setEndpointHealth({
        endpointId: params.endpointId,
        status: failure.status,
        message: failure.message,
      })
    }

    return testFailed(failure.message)
  }
}

function instanceIdOf(value: string): string | null {
  if (value === '') {
    return null
  }

  return value
}

function resolveToken(params: EndpointTestBody, isSavedEndpoint: boolean): string | null {
  if (!isUndefined(params.token)) {
    const token = params.token?.trim() ?? ''

    if (token === '') {
      return null
    }

    return token
  }

  if (!isSavedEndpoint || isNil(params.endpointId)) {
    return null
  }

  return readEndpointToken(params.endpointId)
}

async function fetchJson<T>(params: FetchJsonParams<T>): Promise<T> {
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
    throw new EndpointTestError({ status: 'unreachable', message: OFFLINE_TEXT })
  }

  if (response.status === 401) {
    throw new EndpointTestError({ status: 'unauthorized', message: UNAUTHORIZED_TEXT })
  }

  if (response.status === 403) {
    throw new EndpointTestError({ status: 'forbidden', message: FORBIDDEN_TEXT })
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
    throw new EndpointTestError({ status: 'protocol', message: PROTOCOL_TEXT })
  }

  return parsed.data
}

/** Reads a capped test body. Too large fails as a protocol answer, never as a hang. */
async function readTestJson(response: Response): Promise<unknown> {
  const declared = response.headers.get('content-length')

  if (!isNil(declared) && Number(declared) > MAX_JSON_BODY_BYTES) {
    await response.body?.cancel()

    throw new EndpointTestError({ status: 'protocol', message: PROTOCOL_TEXT })
  }

  try {
    const body = await readCappedBody(response, MAX_JSON_BODY_BYTES)

    return JSON.parse(body.toString('utf8')) as unknown
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new EndpointTestError({ status: 'protocol', message: PROTOCOL_TEXT })
    }

    return null
  }
}

function testFailure(error: unknown): TestFailure {
  if (error instanceof EndpointTestError) {
    return { status: error.status, message: error.message }
  }

  return { status: 'unreachable', message: OFFLINE_TEXT }
}

function testFailed(message: string): EndpointTestResult {
  return {
    ok: false,
    error: message,
    serverVersion: null,
    videoCount: 0,
    imageCount: 0,
    authRequired: null,
    lanAllowed: null,
    instanceId: null,
    lastHealth: null,
  }
}
