import 'server-only'

import { isNonEmptyString, isRecord } from '@/core/guards'

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
