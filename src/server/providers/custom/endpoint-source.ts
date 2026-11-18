import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import { messageOf } from '@/core/errors'
import { isNonEmptyString, isRecord } from '@/core/guards'
import {
  type CustomEndpoint,
  type CustomEndpointFile,
  CustomEndpointFileSchema,
} from '@/core/schemas/custom-endpoint'

import { isCustomEndpointMockMode } from '../../config/mock-mode'
import { readJsonStrict } from '../../fs/json-file'
import { STORAGE_ROOT } from '../../paths'
import { getSecret } from '../../secrets'
import { customMockEndpoints } from '../mock/custom-mock'

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

const warnings = new Set<string>()

let lastGoodFile: CustomEndpointFile | null = null

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

/**
 * Remembers the last parsed file so a transient read error keeps the list.
 */
function rememberFile(file: CustomEndpointFile): CustomEndpointFile {
  lastGoodFile = file
  warnings.clear()

  return file
}

function keepLastGood(error: unknown): CustomEndpointFile | null {
  const message = messageOf(error, 'Unreadable endpoints file')

  if (!warnings.has(message)) {
    warnings.add(message)
    console.warn(`[unplatform-ai] keeping the last endpoints list: ${message}`)
  }

  return lastGoodFile
}

export async function getEndpointFile(): Promise<CustomEndpointFile | null> {
  try {
    const file = await readJsonStrict(ENDPOINTS_FILE, CustomEndpointFileSchema)

    if (isNil(file)) {
      lastGoodFile = null

      return null
    }

    return rememberFile(file)
  } catch (error) {
    return keepLastGood(error)
  }
}

export async function getEndpoints(): Promise<readonly CustomEndpoint[]> {
  if (isCustomEndpointMockMode()) {
    return customMockEndpoints()
  }

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

/**
 * Sync read for the registry, which resolves instances without an await.
 */
export function getEndpointsSync(): readonly CustomEndpoint[] {
  if (isCustomEndpointMockMode()) {
    return customMockEndpoints()
  }

  let text: string

  try {
    text = fs.readFileSync(ENDPOINTS_FILE, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      lastGoodFile = null

      return []
    }

    return keepLastGood(error)?.endpoints ?? []
  }

  const file = parseFile(text)

  if (isNil(file)) {
    return keepLastGood(new Error('Invalid endpoints file'))?.endpoints ?? []
  }

  return rememberFile(file).endpoints
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
  if (!isNonEmptyString(endpoint.instanceId)) {
    return endpoint.id
  }

  return endpoint.instanceId
}
