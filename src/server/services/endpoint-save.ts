import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil, isUndefined, keyBy } from 'lodash-es'

import type { EndpointInput, EndpointOverview, SaveEndpointsParams } from '@/core/api/endpoints'
import {
  type CustomEndpoint,
  type CustomEndpointLastHealth,
  ENDPOINT_BADGE_PATTERN,
} from '@/core/schemas/custom-endpoint'

import { HttpError } from '../errors'
import { isUuid } from '../fs/media-ref'
import { resetCustomProviders } from '../providers/registry'
import {
  applyEndpoints,
  type ApplyEndpointsResult,
  type EndpointEntry,
  listEndpoints,
  normalizeBaseUrl,
} from '../repos/endpoints'
import { secretsReady } from '../secrets'
import { withLock } from '../sync/lock'
import { pruneEndpointCaches } from './endpoint-cache-prune'
import { forgetEndpointHealth, setEndpointHealth } from './endpoint-health'
import { getEndpointOverview } from './endpoint-overview'
import { lastTestAt, lastTestFor } from './endpoint-test'
import {
  planEndpointTokens,
  readTokenMap,
  restoreEndpointTokens,
  writeEndpointTokens,
} from './endpoint-tokens'
import { clearModelCatalog } from './model-catalog'

interface PreparedEndpoint {
  entry: EndpointEntry
  token: string | null | undefined
}

interface SettleSavedHealthParams {
  previous: CustomEndpoint | undefined
  item: PreparedEndpoint
  tokenMap: Record<string, string>
}

interface ResolveLastHealthParams {
  previous: CustomEndpoint | undefined
  baseUrl: string
  token: string | null
  storedToken: string | null
}

interface ResolvedLastHealth {
  lastHealth: CustomEndpointLastHealth | null
  keepHealth: boolean
}

interface SavedHealth {
  id: string
  resolved: ResolvedLastHealth
}

export async function saveEndpoints(params: SaveEndpointsParams): Promise<EndpointOverview> {
  const prepared = params.endpoints.map((input) => {
    return { entry: toEntry(input), token: input.token }
  })

  assertBadges(prepared)
  await secretsReady()

  return withLock('endpoint-save', () => {
    return saveLocked(prepared)
  })
}

/** Serialized under one save lock so the token map and the endpoint file come from one save. */
async function saveLocked(prepared: PreparedEndpoint[]): Promise<EndpointOverview> {
  const current = await listEndpoints()
  const previousById = keyBy(current, 'id')
  const tokenMap = readTokenMap()

  const changes = prepared.map((item) => {
    return { id: item.entry.id, token: item.token }
  })

  const preparedIds = new Set(
    prepared.map((item) => {
      return item.entry.id
    }),
  )

  const removedIds = current.flatMap((endpoint) => {
    if (preparedIds.has(endpoint.id)) {
      return []
    }

    return [endpoint.id]
  })

  const plan = await planEndpointTokens({ changes, removedIds })

  await writeEndpointTokens(plan.serialized)

  const savedHealths = prepared.map((item) => {
    const previous = previousById[item.entry.id]
    const resolved = resolveSavedHealth({ previous, item, tokenMap })

    item.entry.lastHealth = resolved.lastHealth

    return { id: item.entry.id, resolved }
  })

  let result: ApplyEndpointsResult

  try {
    result = await applyEndpoints({
      entries: prepared.map((item) => {
        return item.entry
      }),
    })
  } catch (error) {
    await restoreEndpointTokens(plan.current)

    throw error
  }

  applySavedHealth(savedHealths)

  for (const id of result.removedIds) {
    forgetEndpointHealth(id)
  }

  await pruneEndpointCaches({ current, prepared, removedIds: result.removedIds })
  clearModelCatalog()
  resetCustomProviders()

  return getEndpointOverview()
}

/** The saved health comes from the last server test, never from the client body. */
function resolveSavedHealth(params: SettleSavedHealthParams): ResolvedLastHealth {
  const { previous, item, tokenMap } = params
  const id = item.entry.id
  const token = effectiveToken({ item, tokenMap })
  const storedToken = tokenMap[id] ?? null

  return resolveLastHealth({
    previous,
    baseUrl: item.entry.baseUrl,
    token,
    storedToken,
  })
}

/** Runs only after the endpoint file is safely written. */
function applySavedHealth(healths: SavedHealth[]): void {
  for (const health of healths) {
    if (!isNil(health.resolved.lastHealth)) {
      setEndpointHealth({
        endpointId: health.id,
        status: 'ok',
        message: null,
        maxRunning: health.resolved.lastHealth.maxRunning,
      })

      continue
    }

    if (!health.resolved.keepHealth) {
      forgetEndpointHealth(health.id)
    }
  }
}

/** A success wins, then a newer failure, then the unchanged-endpoint fallback. */
function resolveLastHealth(params: ResolveLastHealthParams): ResolvedLastHealth {
  const { previous, baseUrl, token, storedToken } = params
  const tested = lastTestFor({ baseUrl, token })

  if (!isNil(tested)) {
    return { lastHealth: tested, keepHealth: true }
  }

  const testedAt = lastTestAt({ baseUrl, token })

  if (!isNil(testedAt) && beatsStoredHealth(testedAt, previous?.lastHealth?.checkedAt ?? null)) {
    return { lastHealth: null, keepHealth: true }
  }

  if (isNil(previous)) {
    return { lastHealth: null, keepHealth: false }
  }

  if (previous.baseUrl !== baseUrl || token !== storedToken) {
    return { lastHealth: null, keepHealth: false }
  }

  return { lastHealth: previous.lastHealth, keepHealth: true }
}

/** Same-millisecond failure counts, the in-memory entry already shows it. */
function beatsStoredHealth(checkedAt: string, storedAt: string | null): boolean {
  if (isNil(storedAt)) {
    return true
  }

  return Date.parse(checkedAt) >= Date.parse(storedAt)
}

interface EffectiveTokenParams {
  item: PreparedEndpoint
  tokenMap: Record<string, string>
}

function effectiveToken(params: EffectiveTokenParams): string | null {
  const { item, tokenMap } = params

  if (!isUndefined(item.token)) {
    const token = item.token?.trim() ?? ''

    if (token === '') {
      return null
    }

    return token
  }

  return tokenMap[item.entry.id] ?? null
}

function toEntry(input: EndpointInput): EndpointEntry {
  let id: string = randomUUID()

  if (!isNil(input.id) && isUuid(input.id)) {
    id = input.id
  }

  return {
    id,
    label: input.label,
    badge: input.badge ?? undefined,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    enabled: input.enabled,
    pricing: input.pricing,
    instanceId: input.instanceId,
    lastHealth: input.lastHealth,
  }
}

function assertBadges(prepared: PreparedEndpoint[]): void {
  const used = new Set<string>()

  for (const item of prepared) {
    const badge = (item.entry.badge ?? '').trim().toUpperCase()

    if (badge === '') {
      continue
    }

    if (!ENDPOINT_BADGE_PATTERN.test(badge)) {
      throw new HttpError(400, 'Badge must be 1 to 4 uppercase letters or digits')
    }

    if (used.has(badge)) {
      throw new HttpError(400, `Badge ${badge} is already used`)
    }

    used.add(badge)
  }
}
