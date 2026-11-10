import 'server-only'

import { createHash } from 'node:crypto'

import { isNil, isUndefined } from 'lodash-es'

import type { EndpointTestBody, EndpointTestResult } from '@/core/api/endpoints'
import { ENDPOINT_TEST_CACHE_LIMIT } from '@/core/constants'
import {
  type UpaiHealth,
  UpaiHealthSchema,
  type UpaiModel,
  UpaiModelListSchema,
} from '@/core/protocol/upai'
import type { CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'

import { isCustomEndpointMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { resetCustomProviders } from '../providers/registry'
import { normalizeBaseUrl } from '../repos/endpoints'
import { secretsReady } from '../secrets'
import { countActiveJobs } from './endpoint-active-jobs'
import { recordHealthFailure, recordHealthOk } from './endpoint-health'
import { writeEndpointModels } from './endpoint-model-cache'
import { fetchJson, type TestFailure, testFailure } from './endpoint-test-http'
import { lastHealthOf, mockTestResult } from './endpoint-test-mock'
import { testFailed, testSucceeded } from './endpoint-test-result'
import { readEndpointToken } from './endpoint-tokens'
import { clearModelCatalog } from './model-catalog'

export interface LastTestParams {
  baseUrl: string
  token: string | null
}

interface EndpointTestEntry {
  lastHealth: CustomEndpointLastHealth | null
  checkedAt: string
}

const testCache = globalState<Map<string, EndpointTestEntry>>('endpointTestHealth', () => {
  return new Map()
})

const testRuns = globalState<Map<string, number>>('endpointTestRuns', () => {
  return new Map()
})

interface SetTestCacheEntryParams {
  key: string
  entry: EndpointTestEntry
}

/** Adds one entry, evicting the oldest insertion when the cache is full. */
function setTestCacheEntry(params: SetTestCacheEntryParams): void {
  const { key, entry } = params

  if (!testCache.has(key) && testCache.size >= ENDPOINT_TEST_CACHE_LIMIT) {
    const oldest = testCache.keys().next().value

    if (!isUndefined(oldest)) {
      testCache.delete(oldest)
    }
  }

  testCache.set(key, entry)
}

function testKey(params: LastTestParams): string {
  const hash = createHash('sha256')
    .update(params.token ?? '')
    .digest('hex')

  return `${normalizeBaseUrl(params.baseUrl)}\n${hash}`
}

interface TestRunParams {
  key: string
  run: number
}

/** Marks a new run for the key and returns its number. */
function startTestRun(key: string): number {
  const run = (testRuns.get(key) ?? 0) + 1

  testRuns.set(key, run)

  return run
}

/** False when a newer run for the same key already started. */
function isNewestTestRun(params: TestRunParams): boolean {
  return testRuns.get(params.key) === params.run
}

/** Latest successful test for one normalized URL and token. Server-owned. */
export function lastTestFor(params: LastTestParams): CustomEndpointLastHealth | null {
  return testCache.get(testKey(params))?.lastHealth ?? null
}

/** When the latest test ran, success or failure. Null when no test ran. */
export function lastTestAt(params: LastTestParams): string | null {
  return testCache.get(testKey(params))?.checkedAt ?? null
}

export function forgetLastTest(params: LastTestParams): void {
  testCache.delete(testKey(params))
}

/** Drops every cached test. Called after a save and when the draft is discarded. */
export function clearEndpointTests(): void {
  testCache.clear()
  testRuns.clear()
}

export function __resetEndpointTestsForTests(): void {
  clearEndpointTests()
}

interface SaveTestSuccessParams extends TestRunParams {
  endpointId: string | null
  isSavedEndpoint: boolean
  health: UpaiHealth
  video: readonly UpaiModel[]
  image: readonly UpaiModel[]
  lastHealth: CustomEndpointLastHealth
}

/** Persists a success only while this run is the newest for its key. */
async function saveTestSuccess(params: SaveTestSuccessParams): Promise<void> {
  const { key, run, endpointId, isSavedEndpoint, health, video, image, lastHealth } = params

  if (!isNewestTestRun({ key, run })) {
    return
  }

  if (isSavedEndpoint && !isNil(endpointId)) {
    recordHealthOk(endpointId, health.max_running)

    await writeEndpointModels({ endpointId, kind: 'video', models: video })

    if (!isNewestTestRun({ key, run })) {
      return
    }

    await writeEndpointModels({ endpointId, kind: 'image', models: image })

    if (!isNewestTestRun({ key, run })) {
      return
    }

    clearModelCatalog()
    resetCustomProviders()
  }

  if (!isNewestTestRun({ key, run })) {
    return
  }

  setTestCacheEntry({ key, entry: { lastHealth, checkedAt: lastHealth.checkedAt } })
}

interface SaveTestFailureParams extends TestRunParams {
  endpointId: string | null
  isSavedEndpoint: boolean
  failure: TestFailure
}

/** Persists a failure only while this run is the newest for its key. */
async function saveTestFailure(params: SaveTestFailureParams): Promise<void> {
  const { key, run, endpointId, isSavedEndpoint, failure } = params

  if (!isNewestTestRun({ key, run })) {
    return
  }

  setTestCacheEntry({ key, entry: { lastHealth: null, checkedAt: new Date().toISOString() } })

  if (isSavedEndpoint && !isNil(endpointId)) {
    const isJobRunning = (await countActiveJobs(endpointId)) > 0

    if (!isNewestTestRun({ key, run })) {
      return
    }

    recordHealthFailure({
      endpointId,
      status: failure.status,
      message: failure.message,
      isJobRunning,
    })
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
  const key = testKey({ baseUrl, token })
  const run = startTestRun(key)

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

    const lastHealth = lastHealthOf(health, new Date().toISOString())

    await saveTestSuccess({
      key,
      run,
      endpointId: params.endpointId,
      isSavedEndpoint,
      health,
      video: video.data,
      image: image.data,
      lastHealth,
    })

    return testSucceeded({
      endpointId: params.endpointId,
      baseUrl,
      health,
      video: video.data,
      image: image.data,
      lastHealth,
    })
  } catch (error) {
    const failure = testFailure(error)

    await saveTestFailure({
      key,
      run,
      endpointId: params.endpointId,
      isSavedEndpoint,
      failure,
    })

    return testFailed(failure.message)
  }
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
