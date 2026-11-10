import 'server-only'

import { isNil } from 'lodash-es'

import {
  ENDPOINT_FAILURE_THRESHOLD,
  ENDPOINT_HEALTH_MAX_AGE_MS,
  ENDPOINT_JOB_FAILURE_THRESHOLD,
} from '@/core/constants'
import {
  type EndpointHealthState,
  type EndpointHealthStatus,
  isOfflineHealthStatus,
} from '@/core/endpoints'
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
import {
  errorMessageOf,
  isTimeoutFailure,
  kindOfError,
  kindOfStatus,
  logOffline,
  shortHealthText,
} from './endpoint-health-report'

interface HealthEntry extends EndpointHealthState {
  maxRunning: number | null
}

type HealthFailureSource = 'job' | 'catalog'

export interface SetEndpointHealthParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string | null
  maxRunning?: number | null
}

export interface RecordHealthFromErrorParams {
  endpointId: string
  error: unknown
  source: HealthFailureSource
  isJobRunning: boolean
}

export interface RecordHealthFailureParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string
  isJobRunning?: boolean
}

interface HealthFailureParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string
  kind: string
  isJobRunning: boolean
}

interface EndpointHealthStore {
  entries: Map<string, HealthEntry>
  failures: Map<string, number>
  isListening: boolean
}

const store = globalState<EndpointHealthStore>('endpointHealth', () => {
  return { entries: new Map(), failures: new Map(), isListening: false }
})

function now(): string {
  return new Date().toISOString()
}

function recordHealthOutcome(endpointId: string, outcome: CustomHealthOutcome): void {
  if (outcome.state === 'ok') {
    recordHealthOk(endpointId, outcome.maxRunning)

    return
  }

  recordHealthFailure({
    endpointId,
    status: outcome.state,
    message: outcome.message ?? '',
  })
}

export function registerEndpointHealthListener(): void {
  if (store.isListening) {
    return
  }

  store.isListening = true
  registerCustomHealthListener(recordHealthOutcome)
}

/** A successful poll resets the failure count and keeps the last known limit. */
export function recordHealthOk(endpointId: string, maxRunning?: number | null): void {
  const previous = store.entries.get(endpointId)

  store.failures.delete(endpointId)

  store.entries.set(endpointId, {
    state: 'ok',
    checkedAt: now(),
    message: null,
    maxRunning: maxRunning ?? previous?.maxRunning ?? null,
  })
}

/** A timeout only closes an endpoint while a job poll keeps failing. */
function isQualifyingFailure(error: unknown, source: HealthFailureSource): boolean {
  if (isTimeoutFailure(error)) {
    return source === 'job'
  }

  if (error instanceof TypeError) {
    return true
  }

  if (!(error instanceof ProviderError)) {
    return false
  }

  return (
    error.code === 'comfy_unavailable' ||
    error.code === 'protocol' ||
    error.status === 401 ||
    error.status === 403
  )
}

function healthStateOfError(error: unknown): EndpointHealthStatus {
  if (error instanceof ProviderError) {
    return healthStateOf(error)
  }

  return healthStateOf(networkError(error))
}

function isOffline(endpointId: string): boolean {
  return isOfflineHealthStatus(store.entries.get(endpointId)?.state)
}

/** Counts every failure and only exposes an offline state at the threshold. */
function applyFailure(params: HealthFailureParams): boolean {
  const { endpointId, status, message, kind, isJobRunning } = params
  const failures = (store.failures.get(endpointId) ?? 0) + 1

  store.failures.set(endpointId, failures)

  const threshold = isJobRunning ? ENDPOINT_JOB_FAILURE_THRESHOLD : ENDPOINT_FAILURE_THRESHOLD
  const previous = store.entries.get(endpointId)

  if (failures < threshold) {
    return isOfflineHealthStatus(previous?.state)
  }

  const entryMessage = message === '' ? null : message

  store.entries.set(endpointId, {
    state: status,
    checkedAt: now(),
    message: entryMessage,
    maxRunning: previous?.maxRunning ?? null,
  })

  if (isNil(previous) || previous.state === 'ok') {
    logOffline({ endpointId, kind, message: shortHealthText(message) })
  }

  return isOfflineHealthStatus(status)
}

/** Feeds a failed job poll, catalog fetch or probe into the failure counter. */
export function recordHealthFromError(params: RecordHealthFromErrorParams): boolean {
  const { endpointId, error, source, isJobRunning } = params

  if (!isQualifyingFailure(error, source)) {
    return isOffline(endpointId)
  }

  return applyFailure({
    endpointId,
    status: healthStateOfError(error),
    message: errorMessageOf(error),
    kind: kindOfError(error),
    isJobRunning,
  })
}

/** Same rule for a failure that arrives as a ready status, like the endpoint test. */
export function recordHealthFailure(params: RecordHealthFailureParams): boolean {
  const { endpointId, status, message, isJobRunning = false } = params

  return applyFailure({
    endpointId,
    status,
    message,
    kind: kindOfStatus(status),
    isJobRunning,
  })
}

/** Manual health entry from Settings or an explicit state write. */
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
  store.failures.delete(endpointId)
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
  store.failures.clear()
  store.isListening = false
}
