import 'server-only'

import { PROVIDER_IDS, type ProviderId } from '@/core/providers/types'

import { isMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { createMockProvider } from './mock/provider'
import { createOpenRouterProvider } from './openrouter/provider'
import type { ImageProvider, VideoProvider } from './types'

const DEFAULT_PROVIDER_ID: ProviderId = PROVIDER_IDS[0]

type ImageProviderFactory = () => ImageProvider

type VideoProviderFactory = () => VideoProvider

interface ProviderState {
  video: Map<ProviderId, VideoProvider>
  image: Map<ProviderId, ImageProvider>
  imageFactories: Map<ProviderId, ImageProviderFactory>
}

/** Boot and route bundles can load this module twice, so the maps live on globalThis. */
const state = globalState<ProviderState>('providers', () => {
  return {
    video: new Map<ProviderId, VideoProvider>(),
    image: new Map<ProviderId, ImageProvider>(),
    imageFactories: new Map<ProviderId, ImageProviderFactory>(),
  }
})

const FACTORIES: Record<ProviderId, VideoProviderFactory> = {
  openrouter: createOpenRouterProvider,
}

/** True when the registry selects the mock adapter for this provider. */
function isMockProvider(id: ProviderId): boolean {
  return id === 'openrouter' && isMockMode()
}

/** One configured adapter per provider id. */
export function getVideoProvider(id: ProviderId = DEFAULT_PROVIDER_ID): VideoProvider {
  const existing = state.video.get(id)

  if (existing) {
    return existing
  }

  const isProvider = isMockProvider(id)
  let provider: VideoProvider

  if (isProvider) {
    provider = createMockProvider()
  } else {
    provider = FACTORIES[id]()
  }

  state.video.set(id, provider)

  return provider
}

/** Wired in boot by the image adapter, so this module never imports it. */
export function registerImageProvider(id: ProviderId, factory: ImageProviderFactory): void {
  state.imageFactories.set(id, factory)
  state.image.delete(id)
}

/** One configured image adapter per provider id. Throws when none is registered. */
export function getImageProvider(id: ProviderId = DEFAULT_PROVIDER_ID): ImageProvider {
  const existing = state.image.get(id)

  if (existing) {
    return existing
  }

  const factory = state.imageFactories.get(id)

  if (!factory) {
    throw new Error(`[unplatform-ai] no image provider registered for ${id}`)
  }

  const provider = factory()

  state.image.set(id, provider)

  return provider
}
