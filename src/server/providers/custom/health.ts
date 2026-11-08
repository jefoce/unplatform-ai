import 'server-only'

import { isNil } from 'lodash-es'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { EndpointHealthStatus } from '@/core/endpoints'
import { type UpaiHealth, UpaiHealthSchema } from '@/core/protocol/upai'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { TestResult } from '@/core/types'

import { ProviderError } from '../provider-error'
import { healthStateOf, protocolError } from './errors'
import { emitCustomHealth } from './health-events'
import { customRequest, providerErrorFromResponse, readCustomJson, requestHeaders } from './http'

interface HealthProbeOk {
  ok: true
  health: UpaiHealth
}

interface HealthProbeFailure {
  ok: false
  error: ProviderError
  state: EndpointHealthStatus
}

export type HealthProbe = HealthProbeOk | HealthProbeFailure

/** One health call. Every outcome feeds the endpoint health store. */
export async function runHealthProbe(endpoint: CustomEndpoint): Promise<HealthProbe> {
  try {
    const res = await customRequest({
      endpoint,
      path: '/api/v1/health',
      init: { headers: requestHeaders(endpoint, false), cache: 'no-store' },
      timeoutMs: FETCH_TIMEOUTS.meta,
    })

    if (!res.ok) {
      throw await providerErrorFromResponse(res)
    }

    const header = res.headers.get('x-upai-protocol')

    if (!isNil(header) && header !== '1') {
      throw protocolError('This server does not speak upai/1')
    }

    const parsed = UpaiHealthSchema.safeParse(await readCustomJson(res))

    if (!parsed.success) {
      throw protocolError('This server does not speak upai/1')
    }

    emitCustomHealth(endpoint.id, {
      state: 'ok',
      message: null,
      maxRunning: parsed.data.max_running,
    })

    return { ok: true, health: parsed.data }
  } catch (error) {
    let providerError = protocolError('Health check failed')

    if (error instanceof ProviderError) {
      providerError = error
    }

    const state = healthStateOf(providerError)

    emitCustomHealth(endpoint.id, {
      state,
      message: providerError.storedMessage,
      maxRunning: null,
    })

    return { ok: false, error: providerError, state }
  }
}

export async function testCustomEndpoint(endpoint: CustomEndpoint): Promise<TestResult> {
  const probe = await runHealthProbe(endpoint)

  if (!probe.ok) {
    return { ok: false, error: probe.error.storedMessage }
  }

  return { ok: true, label: `${probe.health.server} ${probe.health.server_version}` }
}
