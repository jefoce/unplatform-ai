'use client'

import { isNil } from 'lodash-es'

import { recordSource } from '@/core/record-source'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import { endpointById, useEndpointsStatus } from '@/lib/api/endpoints-status'

interface DetailsSourceProps {
  record: GenerationRecord | ImageRecord
}

function removedSuffix(isRemoved: boolean): string {
  if (isRemoved) {
    return ' (removed)'
  }

  return ''
}

/** Custom details: workflow name and endpoint label from the record snapshot. */
export function DetailsSource(props: DetailsSourceProps) {
  const { endpoints, isLoading } = useEndpointsStatus()
  const source = recordSource(props.record)

  if (source.kind !== 'custom') {
    return null
  }

  const isRemoved = !isLoading && isNil(endpointById(endpoints, source.instanceId))
  const removed = removedSuffix(isRemoved)

  return (
    <div className="space-y-0.5 text-xxs text-fg-2">
      {!isNil(source.workflowName) && <p>Workflow: {source.workflowName}</p>}
      {!isNil(source.endpointLabel) && (
        <p>
          Endpoint: {source.endpointLabel}
          {removed}
        </p>
      )}
    </div>
  )
}
