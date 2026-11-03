import type { VideoPreset } from '../video/types'
import type { BindingBase, ProviderBinding } from './binding'

interface HasBindings<T extends BindingBase> {
  bindings: readonly [T, ...T[]]
}

/** The binding used for price and default request decisions. */
export function primaryBinding<T extends BindingBase>(preset: HasBindings<T>): T {
  return preset.bindings[0]
}

/**
 * First binding whose provider is configured, else the primary binding.
 * `isConfigured` keeps core free of server imports.
 */
export function activeBinding(
  preset: VideoPreset,
  isConfigured: (binding: ProviderBinding) => boolean,
): ProviderBinding {
  return preset.bindings.find(isConfigured) ?? preset.bindings[0]
}
