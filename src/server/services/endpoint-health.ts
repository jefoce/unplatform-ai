import 'server-only'

import { isNil } from 'lodash-es'

import { ENDPOINT_HEALTH_MAX_AGE_MS } from '@/core/constants'
import type { EndpointHealthState, EndpointHealthStatus } from '@/core/endpoints'
import type { TestResult } from '@/core/types'

import { globalState } from '../global-state'
import {
  endpointQueueKey,
  getEndpoint,
  getEndpointsSync,
} from '../providers/custom/endpoint-source'
import { healthStateOf, networkError } from '../providers/custom/errors'
import { runHealthProbe } from '../providers/custom/health'
import {
  type CustomHealthOutcome,
  registerCustomHealthListener,
} from '../providers/custom/health-events'
import { ProviderError } from '../providers/provider-error'

interface HealthEntry extends EndpointHealthState {
  maxRunning: number | null
}

export interface SetEndpointHealthParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string | null
  maxRunning?: number | null
}

interface EndpointHealthStore {
  entries: Map<string, HealthEntry>
  isListening: boolean
}

const store = globalState<EndpointHealthStore>('endpointHealth', () => {
  return { entries: new Map(), isListening: false }
})

function now(): string {
  return new Date().toISOString()
}

function recordHealthOutcome(endpointId: string, outcome: CustomHealthOutcome): void {
  store.entries.set(endpointId, {
    state: outcome.state,
    checkedAt: now(),
    message: outcome.message,
    maxRunning: outcome.maxRunning,
  })
}

export function registerEndpointHealthListener(): void {
  if (store.isListening) {
    return
  }

  store.isListening = true
  registerCustomHealthListener(recordHealthOutcome)
}

/** A successful poll clears an earlier failure but keeps the last known limit. */
export function recordHealthOk(endpointId: string): void {
  const previous = store.entries.get(endpointId)

  store.entries.set(endpointId, {
    state: 'ok',
    checkedAt: now(),
    message: null,
    maxRunning: previous?.maxRunning ?? null,
  })
}

/** Only transport, auth and protocol failures close an endpoint. */
function isHealthFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  if (!(error instanceof ProviderError)) {
    return false
  }

  return (
    error.status === 0 || error.status === 401 || error.status === 403 || error.code === 'protocol'
  )
}

export function recordHealthFromError(endpointId: string, error: unknown): void {
  if (!isHealthFailure(error)) {
    return
  }

  const previous = store.entries.get(endpointId)
  let status: EndpointHealthStatus = 'unreachable'
  let message = 'unreachable'

  if (error instanceof ProviderError) {
    status = healthStateOf(error)
    message = error.storedMessage
  } else if (error instanceof TypeError) {
    message = networkError(error).storedMessage
  }

  store.entries.set(endpointId, {
    state: status,
    checkedAt: now(),
    message,
    maxRunning: previous?.maxRunning ?? null,
  })
}

/** Manual health entry from Settings, endpoint test or a failed request. */
export function setEndpointHealth(params: SetEndpointHealthParams): void {
  const previous = store.entries.get(params.endpointId)

  store.entries.set(params.endpointId, {
    state: params.status,
    checkedAt: now(),
    message: params.message,
    maxRunning: params.maxRunning ?? previous?.maxRunning ?? null,
  })
}

export function forgetEndpointHealth(endpointId: string): void {
  store.entries.delete(endpointId)
}

export function getHealth(endpointId: string): EndpointHealthState | null {
  const entry = store.entries.get(endpointId)

  if (isNil(entry)) {
    return null
  }

  return { state: entry.state, checkedAt: entry.checkedAt, message: entry.message }
}

export function isHealthFresh(entry: EndpointHealthState): boolean {
  const checkedAt = Date.parse(entry.checkedAt)

  if (!Number.isFinite(checkedAt)) {
    return false
  }

  return Date.now() - checkedAt <= ENDPOINT_HEALTH_MAX_AGE_MS
}

/** Smallest fresh cap across endpoints that report the same pack instance. */
export function getMaxRunning(instanceKey: string): number {
  const endpoints = getEndpointsSync().filter((endpoint) => {
    return endpointQueueKey(endpoint) === instanceKey
  })

  const values: number[] = []

  for (const endpoint of endpoints) {
    const value = store.entries.get(endpoint.id)?.maxRunning ?? endpoint.lastHealth?.maxRunning

    if (!isNil(value)) {
      values.push(value)
    }
  }

  if (values.length === 0) {
    return 1
  }

  return Math.min(...values)
}

/** Fresh protocol check for Settings and the Generate gate. */
export async function checkEndpoint(endpointId: string): Promise<TestResult> {
  registerEndpointHealthListener()
  const endpoint = await getEndpoint(endpointId)

  if (isNil(endpoint)) {
    return { ok: false, error: 'Endpoint removed' }
  }

  const probe = await runHealthProbe(endpoint)

  if (!probe.ok) {
    return { ok: false, error: probe.error.storedMessage }
  }

  return { ok: true, label: `${probe.health.server} ${probe.health.server_version}` }
}

export function __resetEndpointHealthForTests(): void {
  store.entries.clear()
  store.isListening = false
}
