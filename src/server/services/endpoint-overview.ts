import 'server-only'

import { isNil } from 'lodash-es'
import { z } from 'zod'

import type {
  EndpointHealthView,
  EndpointOverview,
  EndpointOverviewEntry,
} from '@/core/api/endpoints'
import { customPresetPrefix } from '@/core/presets/custom'
import type { CustomEndpoint, CustomEndpointLastHealth } from '@/core/schemas/custom-endpoint'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { readJson } from '../fs/json-file'
import { endpointModelsFile, readEndpointFile } from '../repos/endpoints'
import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'
import { secretsReady } from '../secrets'
import { getHealth, isHealthFresh } from './endpoint-health'
import { readTokenMap } from './endpoint-tokens'

const ModelCountsSchema = z
  .object({
    video: z.array(z.unknown()).default([]),
    image: z.array(z.unknown()).default([]),
  })
  .loose()

interface OverviewParams {
  endpoint: CustomEndpoint
  tokenMap: Record<string, string>
  generations: GenerationRecord[]
  images: ImageRecord[]
}

interface ModelCounts {
  videoCount: number
  imageCount: number
}

export async function getEndpointOverview(): Promise<EndpointOverview> {
  const [file, generations, images] = await Promise.all([
    readEndpointFile(),
    listGenerations(),
    listImages(),
  ])

  await secretsReady()
  const tokenMap = readTokenMap()

  const endpoints = await Promise.all(
    file.endpoints.map((endpoint) => {
      return toOverview({ endpoint, tokenMap, generations, images })
    }),
  )

  return { endpoints, nextBadge: `CU${file.badgeCounter + 1}` }
}

async function toOverview(params: OverviewParams): Promise<EndpointOverviewEntry> {
  const { endpoint, tokenMap, generations, images } = params
  const counts = await cachedCounts(endpoint.id)
  const prefix = customPresetPrefix(endpoint.id)

  const videoJobs = generations.filter((record) => {
    return record.preset.id.startsWith(prefix) && ACTIVE_STATUSES.includes(record.status)
  })

  const imageJobs = images.filter((record) => {
    return record.preset.id.startsWith(prefix) && isImageActive(record)
  })

  const known = getHealth(endpoint.id)
  const isFresh = !isNil(known) && isHealthFresh(known)
  const fresh = isFresh ? known : null

  return {
    ...endpoint,
    ...counts,
    runningJobs: videoJobs.length + imageJobs.length,
    status: fresh?.state ?? statusFromHealth(endpoint.lastHealth),
    tokenHint: hintFor(tokenMap[endpoint.id]),
    hasToken: !isNil(tokenMap[endpoint.id]),
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
