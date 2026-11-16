import 'server-only'

import { isNil } from 'lodash-es'

import { FETCH_TIMEOUTS } from '@/core/constants'
import type { EndpointHealthStatus } from '@/core/endpoints'
import { type UpaiHealth, UpaiHealthSchema } from '@/core/protocol/upai'
import { CUSTOM_PROTOCOL_MESSAGE } from '@/core/providers/custom-messages'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { TestResult } from '@/core/types'

import { ProviderError } from '../provider-error'
import { healthStateOf, protocolError } from './errors'
import { type CustomHealthOutcome, emitCustomHealth } from './health-events'
import {
  customRequest,
  endpointOrigin,
  providerErrorFromResponse,
  readCustomJson,
  requestHeaders,
} from './http'

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

type TimerId = ReturnType<typeof setTimeout>

const pendingProbes = new Map<string, Promise<HealthProbe>>()

/** The request timeout plus a margin, so a probe that ignores abort still settles. */
const HEALTH_PROBE_DEADLINE_MS = FETCH_TIMEOUTS.meta + 2_000

/** Null for an invalid base URL, so the probe reports it like any network failure. */
function probeOrigin(endpoint: CustomEndpoint): string | null {
  try {
    return endpointOrigin(endpoint)
  } catch {
    return null
  }
}

/** One health call, shared by concurrent callers on the same origin. */
export async function runHealthProbe(endpoint: CustomEndpoint): Promise<HealthProbe> {
  const origin = probeOrigin(endpoint)

  if (isNil(origin)) {
    return probeEndpoint(endpoint)
  }

  const pending = pendingProbes.get(origin)

  if (!isNil(pending)) {
    return pending
  }

  const probe = probeEndpoint(endpoint)

  pendingProbes.set(origin, probe)

  try {
    return await probe
  } finally {
    pendingProbes.delete(origin)
  }
}

/** One health call, bounded by a deadline so a recorded result always lands. */
async function probeEndpoint(endpoint: CustomEndpoint): Promise<HealthProbe> {
  let isTimedOut = false

  const emit = (outcome: CustomHealthOutcome): void => {
    if (isTimedOut) {
      return
    }

    emitCustomHealth(endpoint.id, outcome)
  }

  const probe = probeRequest(endpoint, emit)

  let timer: TimerId | undefined

  const deadline = new Promise<HealthProbe>((resolve) => {
    timer = setTimeout(() => {
      isTimedOut = true

      const error = protocolError('Health check timed out')

      emitCustomHealth(endpoint.id, {
        state: 'unreachable',
        message: error.storedMessage,
        maxRunning: null,
      })

      resolve({ ok: false, error, state: 'unreachable' })
    }, HEALTH_PROBE_DEADLINE_MS)
  })

  try {
    return await Promise.race([probe, deadline])
  } finally {
    clearTimeout(timer)
  }
}

/** One request whose result is dropped when the deadline already fired. */
async function probeRequest(
  endpoint: CustomEndpoint,
  emit: (outcome: CustomHealthOutcome) => void,
): Promise<HealthProbe> {
  try {
    const res = await customRequest({
      endpoint,
      path: '/api/v1/health',
      init: { headers: requestHeaders(false), cache: 'no-store' },
      timeoutMs: FETCH_TIMEOUTS.meta,
    })

    if (!res.ok) {
      throw await providerErrorFromResponse(res)
    }

    const header = res.headers.get('x-upai-protocol')

    if (!isNil(header) && header !== '1') {
      throw protocolError(CUSTOM_PROTOCOL_MESSAGE)
    }

    const parsed = UpaiHealthSchema.safeParse(await readCustomJson(res))

    if (!parsed.success) {
      throw protocolError(CUSTOM_PROTOCOL_MESSAGE)
    }

    emit({
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

    emit({
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
