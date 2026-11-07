import 'server-only'

import type { ImagePreset } from '@/core/presets/image/types'
import type { VideoPreset } from '@/core/presets/video/types'
import type { CustomEndpoint } from '@/core/schemas/custom-endpoint'
import type { RecordSource } from '@/core/schemas/record-source'

import { workflowNameOf } from './preset-link'

/** Snapshot at create time, so history outlives the endpoint and the workflow. */
export function customRecordSource(
  preset: VideoPreset | ImagePreset,
  endpoint: CustomEndpoint,
): RecordSource {
  return {
    kind: 'custom',
    instanceId: endpoint.id,
    badge: endpoint.badge,
    presetTitle: preset.title,
    workflowName: workflowNameOf(preset),
    endpointLabel: endpoint.label,
    local: true,
  }
}
