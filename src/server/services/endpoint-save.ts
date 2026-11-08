import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil, isUndefined, keyBy } from 'lodash-es'
import { z } from 'zod'

import {
  type CustomEndpoint,
  type CustomEndpointLastHealth,
  CustomEndpointLastHealthSchema,
  type CustomEndpointPricing,
  CustomEndpointPricingSchema,
} from '@/core/schemas/custom-endpoint'

import { HttpError } from '../errors'
import { isUuid } from '../fs/media-ref'
import { resetCustomProviders } from '../providers/registry'
import {
  applyEndpoints,
  type EndpointEntry,
  listEndpoints,
  normalizeBaseUrl,
} from '../repos/endpoints'
import { pruneEndpointCaches } from './endpoint-cache-prune'
import { forgetEndpointHealth, isFreshTest } from './endpoint-health'
import { type EndpointOverview, getEndpointOverview } from './endpoint-overview'
import { applyEndpointTokens } from './endpoint-tokens'
import { clearModelCatalog } from './model-catalog'

export interface EndpointInput {
  id: string | null
  label: string
  badge: string | null
  baseUrl: string
  enabled: boolean
  pricing: CustomEndpointPricing
  instanceId: string | null
  lastHealth: CustomEndpointLastHealth | null
  token?: string | null
}

export interface SaveEndpointsParams {
  endpoints: EndpointInput[]
}

export const EndpointInputSchema = z.object({
  id: z.string().nullable().default(null),
  label: z.string().max(40),
  badge: z.string().nullable().default(null),
  baseUrl: z.string(),
  enabled: z.boolean().default(true),
  pricing: CustomEndpointPricingSchema.default({ mode: 'model', usd: 0 }),
  instanceId: z.string().nullable().default(null),
  lastHealth: CustomEndpointLastHealthSchema.nullable().default(null),
  token: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .regex(/^[^\s]+$/, 'No spaces or line breaks')
    .nullable()
    .optional(),
})

export const SaveEndpointsBodySchema = z.object({ endpoints: z.array(EndpointInputSchema).max(50) })

interface PreparedEndpoint {
  entry: EndpointEntry
  token: string | null | undefined
}

interface EndpointChangeParams {
  previous: CustomEndpoint
  item: PreparedEndpoint
}

export async function saveEndpoints(params: SaveEndpointsParams): Promise<EndpointOverview> {
  const prepared = params.endpoints.map((input) => {
    return { entry: toEntry(input), token: input.token }
  })

  assertBadges(prepared)

  const current = await listEndpoints()
  const previousById = keyBy(current, 'id')

  for (const item of prepared) {
    const id = item.entry.id

    if (isNil(id)) {
      continue
    }

    const previous = previousById[id]

    if (isNil(previous) || !isChanged({ previous, item }) || isFreshTest({ previous, item })) {
      continue
    }

    forgetEndpointHealth(id)
    item.entry.lastHealth = null
  }

  const kept = new Set(
    prepared.map((item) => {
      return item.entry.id
    }),
  )

  const removed = current.filter((endpoint) => {
    return !kept.has(endpoint.id)
  })

  const removedIds = removed.map((endpoint) => {
    return endpoint.id
  })

  const changes = prepared.flatMap((item) => {
    if (isNil(item.entry.id)) {
      return []
    }

    return [{ id: item.entry.id, token: item.token }]
  })

  await applyEndpointTokens({ changes, removedIds })

  const result = await applyEndpoints({
    entries: prepared.map((item) => {
      return item.entry
    }),
  })

  for (const id of result.removedIds) {
    forgetEndpointHealth(id)
  }

  await pruneEndpointCaches({ current, prepared, removedIds: result.removedIds })
  clearModelCatalog()
  resetCustomProviders()

  return getEndpointOverview()
}

function isChanged(params: EndpointChangeParams): boolean {
  const { previous, item } = params

  return (
    previous.baseUrl !== item.entry.baseUrl ||
    previous.enabled !== item.entry.enabled ||
    !isUndefined(item.token)
  )
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
