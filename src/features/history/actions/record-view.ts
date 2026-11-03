import { isNonEmptyString } from '@/core/guards'
import { findPreset } from '@/core/presets'
import { friendlyError } from '@/core/provider-errors'
import type { FriendlyError } from '@/core/provider-errors/types'
import { providerDescriptor } from '@/core/providers/registry'
import type { GenerationRecord } from '@/core/schemas/generation-record'

/** Friendly error for a record, or null when there is no raw text. */
export function recordError(record: GenerationRecord): FriendlyError | null {
  if (!isNonEmptyString(record.error)) {
    return null
  }

  return friendlyError({
    raw: record.error,
    rules: findPreset(record.input.presetId)?.errors ?? [],
    httpCode: record.errorStatus,
    httpRules: providerDescriptor(record.provider).httpRules,
  })
}
