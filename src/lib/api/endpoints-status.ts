'use client'

import { isEmpty, isNil } from 'lodash-es'
import useSWR from 'swr'

import {
  type EndpointOverview,
  type EndpointOverviewEntry,
  EndpointTestResultSchema,
} from '@/core/api/endpoints'
import {
  CATALOG_MISSING_REASON,
  type CatalogEntry,
  catalogEntryReason,
  type ModelCatalog,
} from '@/core/catalog'
import { CUSTOM_CHECK_TIMEOUT_MS } from '@/core/constants'
import { isOfflineHealthStatus } from '@/core/endpoints'
import type { HistoryFacetKind } from '@/core/history-facets'
import { isCustomPresetId } from '@/core/presets/custom'
import { fetcher } from '@/lib/fetcher'

import { ENDPOINTS_KEY, MODELS_KEY } from './swr-keys'

const ENDPOINTS_TEST_PATH = `${ENDPOINTS_KEY}/test`
const CATALOG_PATH = MODELS_KEY
const REMOVED_REASON = 'This endpoint was removed.'

export interface EndpointsState {
  endpoints: EndpointOverviewEntry[]
  isLoading: boolean
  error: unknown
}

interface FreshCheckParams {
  instanceId: string
  presetId: string
}

interface EndpointTestHealth {
  ok: boolean
  error: string | null
}

const EndpointTestHealthSchema = EndpointTestResultSchema.pick({ ok: true, error: true })

/** Poll only while at least one endpoint exists. Zero stops SWR. */
export function endpointRefreshInterval(latest: EndpointOverview | undefined): number {
  if (isNil(latest) || isEmpty(latest.endpoints)) {
    return 0
  }

  return 15_000
}

/** Endpoint list with the last health state, read for the ready gate. */
export function useEndpointsStatus(): EndpointsState {
  const { data, isLoading, error } = useSWR<EndpointOverview>(ENDPOINTS_KEY, fetcher, {
    refreshInterval: endpointRefreshInterval,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })

  return { endpoints: data?.endpoints ?? [], isLoading, error }
}

/** One endpoint by id, or null while loading or after a delete. */
export function endpointById(
  endpoints: readonly EndpointOverviewEntry[],
  instanceId: string | null,
): EndpointOverviewEntry | null {
  if (isNil(instanceId)) {
    return null
  }

  return (
    endpoints.find((endpoint) => {
      return endpoint.id === instanceId
    }) ?? null
  )
}

/** True when at least one enabled endpoint passed health and offers this kind. */
export function hasReadyEndpoint(
  endpoints: readonly EndpointOverviewEntry[],
  kind: HistoryFacetKind,
): boolean {
  return endpoints.some((endpoint) => {
    if (!endpoint.enabled || endpoint.status !== 'ok') {
      return false
    }

    if (kind === 'video') {
      return endpoint.videoCount > 0
    }

    return endpoint.imageCount > 0
  })
}

/** Only a closed endpoint shows the offline pill, never an unchecked one. */
export function isEndpointOffline(
  endpoints: readonly EndpointOverviewEntry[],
  instanceId: string | null,
): boolean {
  const endpoint = endpointById(endpoints, instanceId)

  if (isNil(endpoint)) {
    return false
  }

  return isOfflineHealthStatus(endpoint.status)
}

async function testEndpointHealth(
  instanceId: string,
  baseUrl: string,
): Promise<EndpointTestHealth> {
  const body = JSON.stringify({ baseUrl, endpointId: instanceId })

  const response = await fetch(ENDPOINTS_TEST_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(CUSTOM_CHECK_TIMEOUT_MS),
  })

  const parsed: unknown = await response.json().catch(() => {
    return null
  })

  const result = EndpointTestHealthSchema.safeParse(parsed)

  if (!result.success) {
    return { ok: false, error: 'ComfyUI did not answer in time.' }
  }

  return { ok: result.data.ok, error: result.data.error ?? null }
}

function entryReason(entry: CatalogEntry | undefined): string | null {
  if (isNil(entry)) {
    return CATALOG_MISSING_REASON
  }

  return catalogEntryReason(entry)
}

/** Fresh model presence check, used right before a custom generation is submitted. */
async function checkModel(presetId: string): Promise<string | null> {
  const catalog = await fetcher<ModelCatalog>(CATALOG_PATH)

  const entry = catalog.entries.find((item) => {
    return item.presetId === presetId
  })

  return entryReason(entry)
}

function timeoutReason(signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    signal.addEventListener(
      'abort',
      () => {
        resolve('ComfyUI did not answer in time.')
      },
      { once: true },
    )
  })
}

async function checkPreset(presetId: string): Promise<string | null> {
  const catalog = await fetcher<ModelCatalog>(CATALOG_PATH)

  const entry = catalog.entries.find((item) => {
    return item.presetId === presetId
  })

  if (isNil(entry)) {
    return REMOVED_REASON
  }

  if (entry.source.kind !== 'custom') {
    return null
  }

  const reason = entryReason(entry)

  if (!isNil(reason)) {
    return reason
  }

  return checkCustomEndpoint({ instanceId: entry.source.instanceId, presetId })
}

/** Fresh check for a selected preset. Null means ready or not a custom model. */
export async function freshPresetReason(presetId: string): Promise<string | null> {
  if (!isCustomPresetId(presetId)) {
    return null
  }

  const controller = new AbortController()

  const timer = setTimeout(() => {
    controller.abort()
  }, CUSTOM_CHECK_TIMEOUT_MS)

  try {
    return await Promise.race([checkPreset(presetId), timeoutReason(controller.signal)])
  } finally {
    clearTimeout(timer)
  }
}

/** One fresh health and model check for a custom endpoint. Null means ready. */
export async function checkCustomEndpoint(params: FreshCheckParams): Promise<string | null> {
  const { instanceId, presetId } = params

  const overview = await fetcher<EndpointOverview>(ENDPOINTS_KEY)

  const endpoint = endpointById(overview.endpoints, instanceId)

  if (isNil(endpoint) || !endpoint.enabled) {
    return REMOVED_REASON
  }

  const health = await testEndpointHealth(instanceId, endpoint.baseUrl)

  if (!health.ok) {
    return health.error ?? 'ComfyUI is not reachable.'
  }

  return checkModel(presetId)
}
