import 'server-only'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { ProviderKindId } from '@/core/providers/types'

import { endpointQueueKey, getEndpointSync } from './endpoint-source'
import { endpointRemovedError } from './errors'

interface RecordRefSource {
  instanceId?: string
}

export interface ProviderRecordRef {
  provider: ProviderKindId
  source?: RecordRefSource
}

/** Record provider kind plus the custom endpoint id. */
export function instanceIdOf(record: ProviderRecordRef): string {
  if (record.provider === 'custom') {
    return record.source?.instanceId ?? ''
  }

  return record.provider
}

/** Queue key shared by video and image records: openrouter, custom, or custom:<instance>. */
export function submitQueueKeyOf(record: ProviderRecordRef): string {
  if (record.provider !== 'custom') {
    return 'openrouter'
  }

  const endpointId = record.source?.instanceId

  if (!isNonEmptyString(endpointId)) {
    return 'custom'
  }

  const endpoint = getEndpointSync(endpointId)

  if (isNil(endpoint)) {
    return `custom:${endpointId}`
  }

  return `custom:${endpointQueueKey(endpoint)}`
}

/** A custom preset whose endpoint is gone reports the endpoint, not the model. */
export function missingPresetError(record: ProviderRecordRef): Error {
  if (record.provider !== 'custom') {
    return new Error('Unknown model')
  }

  const endpointId = record.source?.instanceId

  if (isNil(endpointId) || !isNil(getEndpointSync(endpointId))) {
    return new Error('Unknown model')
  }

  return endpointRemovedError()
}
