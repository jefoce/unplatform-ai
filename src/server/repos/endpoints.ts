import 'server-only'

import path from 'node:path'

import { isNil } from 'lodash-es'

import {
  type CustomEndpoint,
  type CustomEndpointFile,
  CustomEndpointFileSchema,
  type CustomEndpointLastHealth,
  type CustomEndpointPricing,
  CustomEndpointSchema,
} from '@/core/schemas/custom-endpoint'

import { HttpError } from '../errors'
import { readJsonStrict, writeJsonAtomic } from '../fs/json-file'
import { STORAGE_ROOT } from '../paths'
import { withLock } from '../sync/lock'

export const ENDPOINTS_FILE = path.join(STORAGE_ROOT, 'data', 'endpoints.json')

export const ENDPOINT_MODELS_DIR = path.join(STORAGE_ROOT, 'data', 'endpoint-models')

const BADGE_NUMBER = /^CU(\d+)$/

const EMPTY_FILE: CustomEndpointFile = { endpoints: [], badgeCounter: 0 }

export interface EndpointEntry {
  id: string
  label: string
  badge?: string
  baseUrl: string
  enabled: boolean
  pricing: CustomEndpointPricing
  instanceId: string | null
  lastHealth: CustomEndpointLastHealth | null
}

export interface ApplyEndpointsParams {
  entries: EndpointEntry[]
}

export interface ApplyEndpointsResult {
  file: CustomEndpointFile
  removedIds: string[]
}

interface BadgeState {
  counter: number
  taken: Set<string>
}

interface BuildEndpointParams {
  entry: EndpointEntry
  state: BadgeState
  used: Set<string>
}

export function endpointModelsFile(id: string): string {
  return path.join(ENDPOINT_MODELS_DIR, `${id}.json`)
}

/** Scheme and host only. A pasted /upai path or any other path is dropped. */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()

  if (trimmed === '') {
    throw new HttpError(400, 'Endpoint URL is required')
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  const withScheme = hasScheme ? trimmed : `http://${trimmed}`

  let url: URL

  try {
    url = new URL(withScheme)
  } catch {
    throw new HttpError(400, 'Endpoint URL is not valid')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Endpoint URL must use http or https')
  }

  return url.origin
}

/** A present but unreadable file must not be overwritten. */
export async function readEndpointFile(): Promise<CustomEndpointFile> {
  const file = await readJsonStrict(ENDPOINTS_FILE, CustomEndpointFileSchema).catch(() => {
    throw new HttpError(500, 'Could not read the endpoints file')
  })

  return file ?? EMPTY_FILE
}

export async function listEndpoints(): Promise<CustomEndpoint[]> {
  const file = await readEndpointFile()

  return file.endpoints
}

/** Replaces the list under the repo lock. Ids left out of `entries` are removed. */
export async function applyEndpoints(params: ApplyEndpointsParams): Promise<ApplyEndpointsResult> {
  return withLock('endpoints', () => {
    return writeEndpoints(params)
  })
}

async function writeEndpoints(params: ApplyEndpointsParams): Promise<ApplyEndpointsResult> {
  const current = await readEndpointFile()
  const state = badgeState(current)
  const used = new Set<string>()

  const endpoints = params.entries.map((entry) => {
    return buildEndpoint({ entry, state, used })
  })

  const kept = new Set(
    endpoints.map((endpoint) => {
      return endpoint.id
    }),
  )

  const removed = current.endpoints.filter((endpoint) => {
    return !kept.has(endpoint.id)
  })

  const removedIds = removed.map((endpoint) => {
    return endpoint.id
  })

  const file = CustomEndpointFileSchema.parse({
    endpoints,
    badgeCounter: state.counter,
  })

  await writeJsonAtomic({ file: ENDPOINTS_FILE, data: file })

  return { file, removedIds }
}

function badgeState(file: CustomEndpointFile): BadgeState {
  const numbers = file.endpoints.flatMap((endpoint) => {
    const match = BADGE_NUMBER.exec(endpoint.badge)

    if (isNil(match)) {
      return []
    }

    return [Number(match[1])]
  })

  return {
    counter: Math.max(file.badgeCounter, ...numbers, 0),
    taken: new Set(
      file.endpoints.map((endpoint) => {
        return endpoint.badge
      }),
    ),
  }
}

function buildEndpoint(params: BuildEndpointParams): CustomEndpoint {
  const { entry, state, used } = params
  const rawBadge = (entry.badge ?? '').trim()
  let badge = rawBadge.toUpperCase()

  if (badge === '') {
    badge = allocateBadge(state, used)
  } else if (used.has(badge)) {
    throw new HttpError(400, `Badge ${badge} is already used`)
  }

  used.add(badge)

  const parsed = CustomEndpointSchema.safeParse({
    id: entry.id,
    label: entry.label.trim(),
    badge,
    baseUrl: normalizeBaseUrl(entry.baseUrl),
    enabled: entry.enabled,
    pricing: entry.pricing,
    instanceId: entry.instanceId,
    lastHealth: entry.lastHealth,
  })

  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid endpoint')
  }

  state.counter = Math.max(state.counter, badgeNumber(badge) ?? 0)

  return parsed.data
}

/** Number of a `CUn` badge, or null for a custom badge. */
function badgeNumber(badge: string): number | null {
  const match = BADGE_NUMBER.exec(badge)

  if (isNil(match)) {
    return null
  }

  return Number(match[1])
}

function allocateBadge(state: BadgeState, used: Set<string>): string {
  let badge: string

  do {
    state.counter += 1
    badge = `CU${state.counter}`
  } while (state.taken.has(badge) || used.has(badge))

  return badge
}
