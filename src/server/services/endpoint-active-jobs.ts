import 'server-only'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'

import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'

/** Active generations plus active images that belong to one endpoint. */
export async function countActiveJobs(endpointId: string): Promise<number> {
  const [generations, images] = await Promise.all([listGenerations(), listImages()])

  const activeGenerations = generations.filter((record: GenerationRecord) => {
    return ACTIVE_STATUSES.includes(record.status) && record.source?.instanceId === endpointId
  })

  const activeImages = images.filter((record: ImageRecord) => {
    return isImageActive(record) && record.source?.instanceId === endpointId
  })

  return activeGenerations.length + activeImages.length
}
