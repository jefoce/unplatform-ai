import 'server-only'

import { isNil } from 'lodash-es'

import type { ProviderKindId } from '@/core/providers/types'
import type { RecordSource } from '@/core/schemas/record-source'

import { getEndpointSync } from './endpoint-source'
import { endpointRemovedError } from './errors'

export interface ProviderRecordRef {
  provider: ProviderKindId
  source?: RecordSource
}

/** Record provider kind plus the custom endpoint id. */
export function instanceIdOf(record: ProviderRecordRef): string {
  if (record.provider === 'custom') {
    return record.source?.instanceId ?? ''
  }

  return record.provider
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
