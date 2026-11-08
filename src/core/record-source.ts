import { isNil } from 'lodash-es'

import type { ProviderKindId } from './providers/types'
import type { RecordSource } from './schemas/record-source'

export interface RecordSourcePreset {
  title: string
}

export interface RecordSourceRecord {
  provider: ProviderKindId
  preset: RecordSourcePreset
  source?: RecordSource
}

export interface SnapshotTitleRecord {
  preset: RecordSourcePreset
  presetSnapshot?: RecordSourcePreset
}

/** Title the record showed at create time, before its preset could leave the catalog. */
export function snapshotTitle(record: SnapshotTitleRecord): string {
  return record.presetSnapshot?.title ?? record.preset.title
}

export function recordSource(record: RecordSourceRecord): RecordSource {
  if (record.source) {
    return record.source
  }

  return {
    kind: record.provider,
    instanceId: 'openrouter',
    badge: null,
    presetTitle: record.preset.title,
    workflowName: null,
    endpointLabel: null,
    local: false,
  }
}

/** `[CU1] Title`, or the plain title without a badge. */
export function sourceTitle(source: RecordSource): string {
  if (isNil(source.badge)) {
    return source.presetTitle
  }

  return `[${source.badge}] ${source.presetTitle}`
}
