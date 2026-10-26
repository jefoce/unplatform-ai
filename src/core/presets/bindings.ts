import type { ModelPreset, ProviderBinding } from './types'

/** The binding used for price and default request decisions. */
export function primaryBinding(preset: ModelPreset): ProviderBinding {
  return preset.bindings[0]
}

/**
 * First binding whose provider is configured, else the primary binding.
 * `isConfigured` keeps core free of server imports.
 */
export function activeBinding(
  preset: ModelPreset,
  isConfigured: (binding: ProviderBinding) => boolean,
): ProviderBinding {
  return preset.bindings.find(isConfigured) ?? preset.bindings[0]
}
