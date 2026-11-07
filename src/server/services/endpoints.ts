import 'server-only'

import { randomUUID } from 'node:crypto'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import type { EndpointHealthStatus } from '@/core/endpoints'
import {
  type CustomEndpoint,
  type CustomEndpointLastHealth,
  CustomEndpointLastHealthSchema,
  type CustomEndpointPricing,
  CustomEndpointPricingSchema,
} from '@/core/schemas/custom-endpoint'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { HttpError } from '../errors'
import { readJson, removeFile } from '../fs/json-file'
import { isUuid } from '../fs/media-ref'
import { globalState } from '../global-state'
import {
  applyEndpoints,
  type EndpointEntry,
  endpointModelsFile,
  listEndpoints,
  normalizeBaseUrl,
  readEndpointFile,
} from '../repos/endpoints'
import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'
import { applyEndpointTokens, readTokenMap } from './endpoint-tokens'

const ModelCountsSchema = z
  .object({
    video: z.array(z.unknown()).default([]),
    image: z.array(z.unknown()).default([]),
  })
  .loose()

export type EndpointHealthView = EndpointHealthStatus | 'unknown'

export interface EndpointRuntime {
  runningJobs: number
  status: EndpointHealthView
  videoCount: number
  imageCount: number
  tokenHint: string | null
}

export interface EndpointOverviewEntry extends CustomEndpoint, EndpointRuntime {}

export interface EndpointOverview {
  endpoints: EndpointOverviewEntry[]
  nextBadge: string
}

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

interface HealthEntry {
  state: EndpointHealthStatus
  checkedAt: string
  message: string | null
}

interface PreparedEndpoint {
  entry: EndpointEntry
  token: string | null | undefined
}

interface OverviewParams {
  endpoint: CustomEndpoint
  tokenMap: Record<string, string>
  generations: GenerationRecord[]
  images: ImageRecord[]
}

interface MarkHealthParams {
  endpointId: string | null
  status: EndpointHealthStatus
  message: string | null
}

interface ModelCounts {
  videoCount: number
  imageCount: number
}

const health = globalState<Map<string, HealthEntry>>('endpointHealth', () => {
  return new Map()
})

export async function getEndpointOverview(): Promise<EndpointOverview> {
  const [file, generations, images] = await Promise.all([
    readEndpointFile(),
    listGenerations(),
    listImages(),
  ])

  const tokenMap = readTokenMap()

  const endpoints = await Promise.all(
    file.endpoints.map((endpoint) => {
      return toOverview({ endpoint, tokenMap, generations, images })
    }),
  )

  return { endpoints, nextBadge: `CU${file.badgeCounter + 1}` }
}

export async function saveEndpoints(params: SaveEndpointsParams): Promise<EndpointOverview> {
  const prepared = params.endpoints.map((input) => {
    return { entry: toEntry(input), token: input.token }
  })

  assertBadges(prepared)

  const current = await listEndpoints()

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
    health.delete(id)
  }

  await Promise.all(result.removedIds.map(removeEndpointCache))

  return getEndpointOverview()
}

export function markEndpointHealth(params: MarkHealthParams): void {
  if (isNil(params.endpointId)) {
    return
  }

  health.set(params.endpointId, {
    state: params.status,
    checkedAt: new Date().toISOString(),
    message: params.message,
  })
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

async function toOverview(params: OverviewParams): Promise<EndpointOverviewEntry> {
  const { endpoint, tokenMap, generations, images } = params
  const counts = await cachedCounts(endpoint.id)
  const prefix = `custom.${endpoint.id}.`

  const videoJobs = generations.filter((record) => {
    return record.preset.id.startsWith(prefix) && ACTIVE_STATUSES.includes(record.status)
  })

  const imageJobs = images.filter((record) => {
    return record.preset.id.startsWith(prefix) && isImageActive(record)
  })

  const known = health.get(endpoint.id)

  return {
    ...endpoint,
    ...counts,
    runningJobs: videoJobs.length + imageJobs.length,
    status: known?.state ?? statusFromHealth(endpoint.lastHealth),
    tokenHint: hintFor(tokenMap[endpoint.id]),
  }
}

async function cachedCounts(id: string): Promise<ModelCounts> {
  const data = await readJson(endpointModelsFile(id), ModelCountsSchema)

  if (isNil(data)) {
    return { videoCount: 0, imageCount: 0 }
  }

  return { videoCount: data.video.length, imageCount: data.image.length }
}

function statusFromHealth(lastHealth: CustomEndpointLastHealth | null): EndpointHealthView {
  if (isNil(lastHealth)) {
    return 'unknown'
  }

  return 'ok'
}

function hintFor(token: string | undefined): string | null {
  if (isNil(token) || token.length < 4) {
    return null
  }

  return token.slice(-4)
}

async function removeEndpointCache(id: string): Promise<void> {
  if (!isUuid(id)) {
    return
  }

  await removeFile(endpointModelsFile(id))
}
