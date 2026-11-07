import 'server-only'

import { type ProviderInstance, type ProviderKindId } from '@/core/providers/types'

import { isMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { createMockProvider } from './mock/provider'
import { createOpenRouterProvider } from './openrouter/provider'
import type { ImageProvider, VideoProvider } from './types'

const DEFAULT_INSTANCE_ID = 'openrouter'

type ImageProviderFactory = () => ImageProvider

type VideoProviderFactory = () => VideoProvider

interface ProviderState {
  video: Map<string, VideoProvider>
  image: Map<string, ImageProvider>
  imageFactories: Map<string, ImageProviderFactory>
}

/** Boot and route bundles can load this module twice, so the maps live on globalThis. */
const state = globalState<ProviderState>('providers', () => {
  return {
    video: new Map<string, VideoProvider>(),
    image: new Map<string, ImageProvider>(),
    imageFactories: new Map<string, ImageProviderFactory>(),
  }
})

const FACTORIES: Record<'openrouter', VideoProviderFactory> = {
  openrouter: createOpenRouterProvider,
}

const OPENROUTER_INSTANCE: ProviderInstance = {
  id: 'openrouter',
  kind: 'openrouter',
  label: 'OpenRouter',
  badge: null,
}

/** True when the registry selects the mock adapter for this instance. */
function isMockProvider(instanceId: string): boolean {
  return instanceId === 'openrouter' && isMockMode()
}

function videoFactory(instanceId: string): VideoProviderFactory {
  if (instanceId !== 'openrouter') {
    throw new Error(`[unplatform-ai] no video provider for ${instanceId}`)
  }

  return FACTORIES.openrouter
}

/** Configured instances for one provider kind. Custom instances arrive with the adapters. */
export function listInstances(kind: ProviderKindId): readonly ProviderInstance[] {
  if (kind === 'openrouter') {
    return [OPENROUTER_INSTANCE]
  }

  return []
}

/** Provider kind behind one instance id. */
export function instanceKind(instanceId: string): ProviderKindId {
  if (instanceId === 'openrouter') {
    return 'openrouter'
  }

  throw new Error(`[unplatform-ai] unknown provider instance ${instanceId}`)
}

/** One configured adapter per instance id. */
export function getVideoProvider(instanceId: string = DEFAULT_INSTANCE_ID): VideoProvider {
  const existing = state.video.get(instanceId)

  if (existing) {
    return existing
  }

  const isMock = isMockProvider(instanceId)
  let provider: VideoProvider

  if (isMock) {
    provider = createMockProvider()
  } else {
    provider = videoFactory(instanceId)()
  }

  state.video.set(instanceId, provider)

  return provider
}

/** Wired in boot by the image adapter, so this module never imports it. */
export function registerImageProvider(instanceId: string, factory: ImageProviderFactory): void {
  state.imageFactories.set(instanceId, factory)
  state.image.delete(instanceId)
}

/** One configured image adapter per instance id. Throws when none is registered. */
export function getImageProvider(instanceId: string = DEFAULT_INSTANCE_ID): ImageProvider {
  const existing = state.image.get(instanceId)

  if (existing) {
    return existing
  }

  const factory = state.imageFactories.get(instanceId)

  if (!factory) {
    throw new Error(`[unplatform-ai] no image provider registered for ${instanceId}`)
  }

  const provider = factory()

  state.image.set(instanceId, provider)

  return provider
}
