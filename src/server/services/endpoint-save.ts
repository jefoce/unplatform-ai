import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil, isUndefined, keyBy } from 'lodash-es'

import type { EndpointInput, EndpointOverview, SaveEndpointsParams } from '@/core/api/endpoints'
import { type CustomEndpoint, type CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'

import { HttpError } from '../errors'
import { isUuid } from '../fs/media-ref'
import { resetCustomProviders } from '../providers/registry'
import {
  applyEndpoints,
  type EndpointEntry,
  listEndpoints,
  normalizeBaseUrl,
} from '../repos/endpoints'
import { secretsReady } from '../secrets'
import { pruneEndpointCaches } from './endpoint-cache-prune'
import { forgetEndpointHealth, setEndpointHealth } from './endpoint-health'
import { getEndpointOverview } from './endpoint-overview'
import { lastTestFor } from './endpoint-test'
import { applyEndpointTokens, readTokenMap } from './endpoint-tokens'
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

export async function saveEndpoints(params: SaveEndpointsParams): Promise<EndpointOverview> {
  const prepared = params.endpoints.map((input) => {
    return { entry: toEntry(input), token: input.token }
  })

  assertBadges(prepared)
  await secretsReady()

  const current = await listEndpoints()
  const previousById = keyBy(current, 'id')
  const tokenMap = readTokenMap()

  for (const item of prepared) {
    const previous = previousById[item.entry.id ?? '']

    settleSavedHealth({ previous, item, tokenMap })
  }

  const result = await applyEndpoints({
    entries: prepared.map((item) => {
      return item.entry
    }),
  })

  const changes = prepared.flatMap((item) => {
    if (isNil(item.entry.id)) {
      return []
    }

    return [{ id: item.entry.id, token: item.token }]
  })

  await applyEndpointTokens({ changes, removedIds: result.removedIds })

  for (const id of result.removedIds) {
    forgetEndpointHealth(id)
  }

  await pruneEndpointCaches({ current, prepared, removedIds: result.removedIds })
  clearModelCatalog()
  resetCustomProviders()

  return getEndpointOverview()
}

/** The saved health comes from the last server test, never from the client body. */
function settleSavedHealth(params: SettleSavedHealthParams): void {
  const { previous, item, tokenMap } = params
  const id = item.entry.id ?? ''
  const token = effectiveToken({ item, tokenMap })
  const storedToken = tokenMap[id] ?? null

  const lastHealth = resolveLastHealth({
    previous,
    baseUrl: item.entry.baseUrl,
    token,
    storedToken,
  })

  item.entry.lastHealth = lastHealth

  if (isNil(item.entry.id)) {
    return
  }

  if (isNil(lastHealth)) {
    forgetEndpointHealth(item.entry.id)

    return
  }

  setEndpointHealth({
    endpointId: item.entry.id,
    status: 'ok',
    message: null,
    maxRunning: lastHealth.maxRunning,
  })
}

function resolveLastHealth(params: ResolveLastHealthParams): CustomEndpointLastHealth | null {
  const { previous, baseUrl, token, storedToken } = params
  const tested = lastTestFor({ baseUrl, token })

  if (!isNil(tested)) {
    return tested
  }

  if (isNil(previous)) {
    return null
  }

  if (previous.baseUrl !== baseUrl || token !== storedToken) {
    return null
  }

  return previous.lastHealth
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

  return tokenMap[item.entry.id ?? ''] ?? null
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

    if (!/^[A-Z0-9]{1,4}$/.test(badge)) {
      throw new HttpError(400, 'Badge must be 1 to 4 uppercase letters or digits')
    }

    if (used.has(badge)) {
      throw new HttpError(400, `Badge ${badge} is already used`)
    }

    used.add(badge)
  }
}
