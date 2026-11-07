import 'server-only'

import type { ProviderKindId } from '@/core/providers/types'
import type { RecordSource } from '@/core/schemas/record-source'

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
