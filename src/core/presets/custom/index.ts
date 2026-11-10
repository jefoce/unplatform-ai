import { isNonEmptyString } from '../../guards'

const CUSTOM_PRESET_PREFIX = 'custom.'

/** True for IDs built by presetIdFor: "custom.<endpoint>.<model>". */
export function isCustomPresetId(presetId: string): boolean {
  return presetId.startsWith(CUSTOM_PRESET_PREFIX)
}

/** Endpoint id from "custom.<endpointId>.<modelId>", or null. */
export function endpointIdFromPresetId(presetId: string): string | null {
  if (!isCustomPresetId(presetId)) {
    return null
  }

  const endpointId = presetId.split('.')[1]

  if (!isNonEmptyString(endpointId)) {
    return null
  }

  return endpointId
}

/** Prefix that links a preset id to its endpoint: "custom.<endpoint>.". */
export function customPresetPrefix(endpointId: string): string {
  return `${CUSTOM_PRESET_PREFIX}${endpointId}.`
}
