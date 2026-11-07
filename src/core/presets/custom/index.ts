export const CUSTOM_PRESET_PREFIX = 'custom.'

/** True for IDs built by presetIdFor: "custom.<endpoint>.<model>". */
export function isCustomPresetId(presetId: string): boolean {
  return presetId.startsWith(CUSTOM_PRESET_PREFIX)
}
