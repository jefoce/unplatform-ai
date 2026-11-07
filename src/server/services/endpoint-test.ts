import 'server-only'

import { isNil, isUndefined } from 'lodash-es'
import { z, type ZodType } from 'zod'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { EndpointHealthStatus } from '@/core/endpoints'
import { UpaiHealthSchema, UpaiModelListSchema } from '@/core/protocol/upai'
import {
  type CustomEndpointLastHealth,
  CustomEndpointLastHealthSchema,
} from '@/core/schemas/custom-endpoint'

import { resetCustomProviders } from '../providers/registry'
import { normalizeBaseUrl } from '../repos/endpoints'
import { writeEndpointModels } from './endpoint-model-cache'
import { readEndpointToken } from './endpoint-tokens'
import { markEndpointHealth } from './endpoints'
import { clearModelCatalog } from './model-catalog'

const UNAUTHORIZED_TEXT = 'Token needed or wrong'

const FORBIDDEN_TEXT =
  'This computer cannot reach ComfyUI: enable LAN access in ComfyUI Settings > Unplatform AI, or add a token'

const OFFLINE_TEXT = 'Start ComfyUI, then test again'

const PROTOCOL_TEXT = 'This server does not speak upai/1'

export interface EndpointTestParams {
  baseUrl: string
  endpointId: string | null
  token?: string | null
}

export interface EndpointTestResult {
  ok: boolean
  error: string | null
  protocol: number | null
  serverVersion: string | null
  videoCount: number
  imageCount: number
  authRequired: boolean | null
  lanAllowed: boolean | null
  instanceId: string | null
  maxRunning: number | null
  lastHealth: CustomEndpointLastHealth | null
}

export const TestEndpointBodySchema = z.object({
  baseUrl: z.string(),
  endpointId: z.string().nullable().default(null),
  token: z.string().trim().max(4096).nullable().optional(),
})

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

export async function testEndpoint(params: EndpointTestParams): Promise<EndpointTestResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl)
  const token = resolveToken(params)
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

    markEndpointHealth({ endpointId: params.endpointId, status: 'ok', message: null })

    if (!isNil(params.endpointId)) {
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

    const lastHealth = CustomEndpointLastHealthSchema.parse({
      protocol: health.protocol,
      serverVersion: health.server_version,
      maxRunning: health.max_running,
      lanAllowed: health.lan_allowed,
      authRequired: health.auth_required,
      maxUploadBytes: health.max_upload_bytes,
      checkedAt,
    })

    return {
      ok: true,
      error: null,
      protocol: health.protocol,
      serverVersion: health.server_version,
      videoCount: video.data.length,
      imageCount: image.data.length,
      authRequired: health.auth_required,
      lanAllowed: health.lan_allowed,
      instanceId: instanceIdOf(health.instance_id),
      maxRunning: health.max_running,
      lastHealth,
    }
  } catch (error) {
    const failure = testFailure(error)

    markEndpointHealth({
      endpointId: params.endpointId,
      status: failure.status,
      message: failure.message,
    })

    return testFailed(failure.message)
  }
}

function instanceIdOf(value: string): string | null {
  if (value === '') {
    return null
  }

  return value
}

function resolveToken(params: EndpointTestParams): string | null {
  if (!isUndefined(params.token)) {
    const token = params.token?.trim() ?? ''

    if (token === '') {
      return null
    }

    return token
  }

  if (isNil(params.endpointId)) {
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

  const value: unknown = await response.json().catch(() => {
    return null
  })

  const parsed = params.schema.safeParse(value)

  if (!parsed.success) {
    throw new EndpointTestError({ status: 'protocol', message: PROTOCOL_TEXT })
  }

  return parsed.data
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
    protocol: null,
    serverVersion: null,
    videoCount: 0,
    imageCount: 0,
    authRequired: null,
    lanAllowed: null,
    instanceId: null,
    maxRunning: null,
    lastHealth: null,
  }
}
