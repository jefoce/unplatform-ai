'use client'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'
import { useEndpointsSnapshot } from '@/features/shared/endpoints-status-context'
import { isEndpointOffline } from '@/lib/api/endpoints-status'

/** True while an active custom record's endpoint is not reachable. */
export function useRecordOffline(record: GenerationRecord): boolean {
  const { endpoints } = useEndpointsSnapshot()
  const source = record.source

  if (source?.kind !== 'custom' || !ACTIVE_STATUSES.includes(record.status)) {
    return false
  }

  return isEndpointOffline(endpoints, source.instanceId)
}

/** True while an active custom image record's endpoint is not reachable. */
export function useImageRecordOffline(record: ImageRecord): boolean {
  const { endpoints } = useEndpointsSnapshot()
  const source = record.source
  const isActive = record.status === 'submitting' || record.status === 'saving'

  if (source?.kind !== 'custom' || !isActive) {
    return false
  }

  return isEndpointOffline(endpoints, source.instanceId)
}
