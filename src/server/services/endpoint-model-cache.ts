import 'server-only'

import { isNil } from 'lodash-es'

import type { UpaiModel } from '@/core/protocol/upai'
import { type CustomEndpoint } from '@/core/schemas/custom-endpoint'

import { readJson, removeFile, writeJsonAtomic } from '../fs/json-file'
import { globalState } from '../global-state'
import { getEndpointSync } from '../providers/custom/endpoint-source'
import { endpointModelsFile, listEndpoints } from '../repos/endpoints'
import { withLock } from '../sync/lock'
import {
  type EndpointModelCache,
  type EndpointModelCacheFile,
  EndpointModelCacheSchema,
  type EndpointModelKind,
  isSafeEndpointId,
  nextCacheFile,
  presentCache,
} from './endpoint-model-file'

interface CacheState {
  files: Map<string, EndpointModelCacheFile | null>
  unreachable: Set<string>
}

interface WriteEndpointModelsParams {
  endpointId: string
  kind: EndpointModelKind
  models: readonly UpaiModel[]
}

const state = globalState<CacheState>('endpointModelCache', () => {
  return { files: new Map(), unreachable: new Set() }
})

/** Enabled endpoints only, read through the endpoint repo. */
export async function listEnabledCustomEndpoints(): Promise<CustomEndpoint[]> {
  const endpoints = await listEndpoints()

  const enabled = endpoints.filter((endpoint) => {
    return endpoint.enabled && isSafeEndpointId(endpoint.id)
  })

  const enabledIds = new Set(
    enabled.map((endpoint) => {
      return endpoint.id
    }),
  )

  for (const endpointId of Array.from(state.files.keys())) {
    if (!enabledIds.has(endpointId)) {
      state.files.delete(endpointId)
    }
  }

  return enabled
}

/** Raw cached models, with expired missing entries dropped. */
export async function readEndpointModels(endpointId: string): Promise<EndpointModelCache | null> {
  const file = await readCacheFile(endpointId)

  return presentCache(file)
}

export async function writeEndpointModels(params: WriteEndpointModelsParams): Promise<void> {
  const { endpointId, kind, models } = params

  if (!isSafeEndpointId(endpointId)) {
    throw new Error(`Invalid endpoint id: ${endpointId}`)
  }

  await withLock(`endpoint-models:${endpointId}`, async () => {
    if (isNil(getEndpointSync(endpointId))) {
      return
    }

    const nextFile = nextCacheFile({ previous: await readCacheFile(endpointId), kind, models })

    await writeJsonAtomic({ file: endpointModelsFile(endpointId), data: nextFile })
    state.files.set(endpointId, nextFile)
    markEndpointReachable(endpointId)
  })
}

export async function removeEndpointModelCache(endpointId: string): Promise<void> {
  if (!isSafeEndpointId(endpointId)) {
    return
  }

  await withLock(`endpoint-models:${endpointId}`, async () => {
    await removeFile(endpointModelsFile(endpointId))
    state.files.delete(endpointId)
    state.unreachable.delete(endpointId)
  })
}

/** Drops memory only. Files stay, so the next read reloads them. */
export function clearEndpointModelCache(): void {
  state.files.clear()
  state.unreachable.clear()
}

export function markEndpointUnreachable(endpointId: string): void {
  state.unreachable.add(endpointId)
}

export function markEndpointReachable(endpointId: string): void {
  state.unreachable.delete(endpointId)
}

export function isEndpointUnreachable(endpointId: string): boolean {
  return state.unreachable.has(endpointId)
}

async function readCacheFile(endpointId: string): Promise<EndpointModelCacheFile | null> {
  if (!isSafeEndpointId(endpointId)) {
    return null
  }

  if (state.files.has(endpointId)) {
    return state.files.get(endpointId) ?? null
  }

  const file = await readJson(endpointModelsFile(endpointId), EndpointModelCacheSchema)

  state.files.set(endpointId, file)

  return file
}
