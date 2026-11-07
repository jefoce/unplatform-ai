import 'server-only'

import { isNonEmptyString, isRecord } from '@/core/guards'
import { isCustomPresetId } from '@/core/presets/custom'

/** `custom.<endpointId>.<modelId>` per design section 4. */
export function endpointIdFromPresetId(presetId: string): string | null {
  if (!isCustomPresetId(presetId)) {
    return null
  }

  const parts = presetId.split('.')
  const endpointId = parts[1]

  if (!isNonEmptyString(endpointId)) {
    return null
  }

  return endpointId
}

/** Workflow name is optional preset metadata, absent on static presets. */
export function workflowNameOf(preset: unknown): string | null {
  if (!isRecord(preset)) {
    return null
  }

  const value = preset.workflowName

  if (!isNonEmptyString(value)) {
    return null
  }

  return value
}
