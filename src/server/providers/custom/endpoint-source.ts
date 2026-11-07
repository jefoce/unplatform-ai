import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { isNonEmptyString } from '@/core/guards'
import {
  type CustomEndpoint,
  type CustomEndpointFile,
  CustomEndpointFileSchema,
} from '@/core/schemas/custom-endpoint'

import { readJson } from '../../fs/json-file'
import { STORAGE_ROOT } from '../../paths'
import { getSecret } from '../../secrets'

/** w-settings owns the writer repo. The adapter only reads the same file. */
export const ENDPOINTS_FILE = path.join(STORAGE_ROOT, 'data', 'endpoints.json')

const TokenMapSchema = z.record(z.string(), z.string())

function parseFile(text: string): CustomEndpointFile | null {
  try {
    const raw: unknown = JSON.parse(text)
    const parsed = CustomEndpointFileSchema.safeParse(raw)

    if (!parsed.success) {
      return null
    }

    return parsed.data
  } catch {
    return null
  }
}

export async function getEndpointFile(): Promise<CustomEndpointFile | null> {
  return readJson(ENDPOINTS_FILE, CustomEndpointFileSchema)
}

export async function getEndpoints(): Promise<readonly CustomEndpoint[]> {
  const file = await getEndpointFile()

  return file?.endpoints ?? []
}

export async function getEndpoint(id: string): Promise<CustomEndpoint | null> {
  const endpoints = await getEndpoints()

  return (
    endpoints.find((endpoint) => {
      return endpoint.id === id
    }) ?? null
  )
}

/** Sync read for the registry, which resolves instances without an await. */
export function getEndpointsSync(): readonly CustomEndpoint[] {
  try {
    const file = parseFile(fs.readFileSync(ENDPOINTS_FILE, 'utf8'))

    return file?.endpoints ?? []
  } catch {
    return []
  }
}

export function getEndpointSync(id: string): CustomEndpoint | null {
  const endpoints = getEndpointsSync()

  return (
    endpoints.find((endpoint) => {
      return endpoint.id === id
    }) ?? null
  )
}

/** Compact JSON map keyed by endpoint id. Missing or malformed reads as no token. */
export function getEndpointToken(endpointId: string): string | null {
  const raw = getSecret('CUSTOM_ENDPOINT_TOKENS')

  if (!isNonEmptyString(raw)) {
    return null
  }

  try {
    const value: unknown = JSON.parse(raw)
    const parsed = TokenMapSchema.safeParse(value)

    if (!parsed.success) {
      return null
    }

    const token = parsed.data[endpointId]

    if (!isNonEmptyString(token)) {
      return null
    }

    return token
  } catch {
    return null
  }
}

/** Two endpoints that report the same pack instance share one queue limit. */
export function endpointQueueKey(endpoint: CustomEndpoint): string {
  return endpoint.instanceId ?? endpoint.id
}
