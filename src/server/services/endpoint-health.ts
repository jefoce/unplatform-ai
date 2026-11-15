/* eslint-disable max-lines -- one health store owns probe, status and failure writes */
import 'server-only'

import { setTimeout as delay } from 'node:timers/promises'

import { isNil } from 'lodash-es'

import {
  CUSTOM_CHECK_TIMEOUT_MS,
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

import { isCustomEndpointMockMode } from '../config/mock-mode'
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
  logOnline,
  shortHealthText,
} from './endpoint-health-report'

interface HealthEntry extends EndpointHealthState {
  maxRunning: number | null
  verified: boolean
}

type HealthFailureSource = 'job' | 'catalog'

export interface SetEndpointHealthParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string | null
  maxRunning?: number | null
  verified?: boolean
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

interface WriteFailureEntryParams {
  endpointId: string
  status: EndpointHealthStatus
  message: string
  kind: string
  maxRunning: number | null
  isVerified: boolean
  previousState: EndpointHealthStatus | undefined
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
    verified: true,
  })

  if (!isNil(previous) && isOfflineHealthStatus(previous.state)) {
    logOnline(endpointId)
  }
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

function writeFailureEntry(params: WriteFailureEntryParams): void {
  const { endpointId, status, message, kind, maxRunning, isVerified, previousState } = params
  const entryMessage = message === '' ? null : message

  store.entries.set(endpointId, {
    state: status,
    checkedAt: now(),
    message: entryMessage,
    maxRunning,
    verified: isVerified,
  })

  if (isNil(previousState) || previousState === 'ok') {
    logOffline({ endpointId, kind, message: shortHealthText(message) })
  }
}

/** Counts failures, and closes an unverified endpoint on the first one. */
function applyFailure(params: HealthFailureParams): boolean {
  const { endpointId, status, message, kind, isJobRunning } = params
  const previous = store.entries.get(endpointId)

  if (isNil(previous) || !previous.verified) {
    writeFailureEntry({
      endpointId,
      status,
      message,
      kind,
      maxRunning: previous?.maxRunning ?? null,
      isVerified: false,
      previousState: previous?.state,
    })

    return isOfflineHealthStatus(status)
  }

  const failures = (store.failures.get(endpointId) ?? 0) + 1

  store.failures.set(endpointId, failures)

  const threshold = isJobRunning ? ENDPOINT_JOB_FAILURE_THRESHOLD : ENDPOINT_FAILURE_THRESHOLD

  if (failures < threshold) {
    return isOfflineHealthStatus(previous.state)
  }

  writeFailureEntry({
    endpointId,
    status,
    message,
    kind,
    maxRunning: previous.maxRunning,
    isVerified: true,
    previousState: previous.state,
  })

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
  const { endpointId, status, message, maxRunning, verified: isVerified = true } = params
  const previous = store.entries.get(endpointId)

  store.entries.set(endpointId, {
    state: status,
    checkedAt: now(),
    message,
    maxRunning: maxRunning ?? previous?.maxRunning ?? null,
    verified: isVerified,
  })
}

export function forgetEndpointHealth(endpointId: string): void {
  store.entries.delete(endpointId)
  store.failures.delete(endpointId)
}

/** True only after a health check succeeded in this session. */
export function isEndpointVerified(endpointId: string): boolean {
  return store.entries.get(endpointId)?.verified ?? false
}

/** An endpoint may start work only after a successful check in this session and no offline state. */
export function isEndpointUsable(endpointId: string): boolean {
  const entry = store.entries.get(endpointId)

  if (isNil(entry) || !entry.verified) {
    return false
  }

  return !isOfflineHealthStatus(entry.state)
}

/** Waits up to `timeoutMs` for the boot probe, then reports usability. */
export async function awaitEndpointUsable(
  endpointId: string,
  timeoutMs: number = CUSTOM_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (isEndpointUsable(endpointId)) {
      return true
    }

    if (isEndpointVerified(endpointId)) {
      return false
    }

    await delay(100)
  }

  return isEndpointUsable(endpointId)
}

/** Probes every enabled endpoint once, in parallel. Demo endpoints are usable at boot. */
export async function probeEnabledEndpoints(): Promise<void> {
  const endpoints = getEndpointsSync().filter((endpoint) => {
    return endpoint.enabled
  })

  if (isCustomEndpointMockMode()) {
    for (const endpoint of endpoints) {
      recordHealthOk(endpoint.id)
    }

    return
  }

  await Promise.all(
    endpoints.map((endpoint) => {
      return checkEndpoint(endpoint.id)
    }),
  )
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
    const value = store.entries.get(endpoint.id)?.maxRunning

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
