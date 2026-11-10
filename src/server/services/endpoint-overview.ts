import 'server-only'

import { isNil } from 'lodash-es'

import type {
  EndpointHealthView,
  EndpointOverview,
  EndpointOverviewEntry,
} from '@/core/api/endpoints'
import { endpointIdFromPresetId } from '@/core/presets/custom'
import type { CustomEndpoint, CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { isCustomEndpointMockMode } from '../config/mock-mode'
import {
  customMockCatalogForInstance,
  customMockEndpoint,
  customMockInstances,
} from '../providers/mock/custom-mock'
import { readEndpointFile } from '../repos/endpoints'
import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'
import { secretsReady } from '../secrets'
import { getHealth, isHealthFresh } from './endpoint-health'
import { readEndpointModels } from './endpoint-model-cache'
import { readTokenMap } from './endpoint-tokens'

interface OverviewParams {
  endpoint: CustomEndpoint
  tokenMap: Record<string, string>
  runningJobs: Map<string, number>
}

export async function getEndpointOverview(): Promise<EndpointOverview> {
  if (isCustomEndpointMockMode()) {
    return mockOverview()
  }

  const [file, generations, images] = await Promise.all([
    readEndpointFile(),
    listGenerations(),
    listImages(),
  ])

  await secretsReady()
  const tokenMap = readTokenMap()
  const runningJobs = countRunningJobs(generations, images)

  const endpoints = await Promise.all(
    file.endpoints.map((endpoint) => {
      return toOverview({ endpoint, tokenMap, runningJobs })
    }),
  )

  return { endpoints, nextBadge: `CU${file.badgeCounter + 1}` }
}

function mockOverview(): EndpointOverview {
  const endpoints = customMockInstances().map((instance): EndpointOverviewEntry => {
    const catalog = customMockCatalogForInstance(instance.id)
    const status: EndpointHealthView = catalog.isReachable ? 'ok' : 'unreachable'

    return {
      ...customMockEndpoint(instance),
      runningJobs: 0,
      status,
      videoCount: catalog.video.length,
      imageCount: catalog.image.length,
      tokenHint: null,
      hasToken: false,
    }
  })

  return { endpoints, nextBadge: `CU${customMockInstances().length + 1}` }
}

async function toOverview(params: OverviewParams): Promise<EndpointOverviewEntry> {
  const { endpoint, tokenMap, runningJobs } = params
  const models = await readEndpointModels(endpoint.id)

  const known = getHealth(endpoint.id)
  const isFresh = !isNil(known) && isHealthFresh(known)
  const fresh = isFresh ? known : null

  return {
    ...endpoint,
    videoCount: models?.video.length ?? 0,
    imageCount: models?.image.length ?? 0,
    runningJobs: runningJobs.get(endpoint.id) ?? 0,
    status: fresh?.state ?? statusFromHealth(endpoint.lastHealth),
    tokenHint: hintFor(tokenMap[endpoint.id]),
    hasToken: !isNil(tokenMap[endpoint.id]),
  }
}

/** One pass over both record lists, keyed by endpoint id. */
function countRunningJobs(
  generations: readonly GenerationRecord[],
  images: readonly ImageRecord[],
): Map<string, number> {
  const counts = new Map<string, number>()

  const add = (presetId: string): void => {
    const endpointId = endpointIdFromPresetId(presetId)

    if (isNil(endpointId)) {
      return
    }

    counts.set(endpointId, (counts.get(endpointId) ?? 0) + 1)
  }

  for (const record of generations) {
    if (ACTIVE_STATUSES.includes(record.status)) {
      add(record.preset.id)
    }
  }

  for (const record of images) {
    if (isImageActive(record)) {
      add(record.preset.id)
    }
  }

  return counts
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
