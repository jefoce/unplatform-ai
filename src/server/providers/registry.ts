import 'server-only'

import { isNil } from 'lodash-es'

import { type ProviderInstance, type ProviderKindId } from '@/core/providers/types'

import { isMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { getEndpointsSync, getEndpointSync } from './custom/endpoint-source'
import { createCustomImageProvider } from './custom/image'
import { createCustomVideoProvider } from './custom/video'
import { createCustomMockImageProvider, createCustomMockVideoProvider } from './mock/custom-mock'
import { createMockProvider } from './mock/provider'
import { createOpenRouterProvider } from './openrouter/provider'
import type { ImageProvider, VideoProvider } from './types'

const DEFAULT_INSTANCE_ID = 'openrouter'

type ImageProviderFactory = () => ImageProvider

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

const OPENROUTER_INSTANCE: ProviderInstance = {
  id: 'openrouter',
  kind: 'openrouter',
  label: 'OpenRouter',
  badge: null,
}

function isCustomMockMode(): boolean {
  return process.env.CUSTOM_ENDPOINT_MOCK === '1'
}

function customEndpoint(instanceId: string) {
  const endpoint = getEndpointSync(instanceId)

  if (isNil(endpoint)) {
    throw new Error(`[unplatform-ai] unknown provider instance ${instanceId}`)
  }

  return endpoint
}

/** Configured instances for one provider kind. Custom instances come from the endpoint file. */
export function listInstances(kind: ProviderKindId): readonly ProviderInstance[] {
  if (kind === 'openrouter') {
    return [OPENROUTER_INSTANCE]
  }

  return getEndpointsSync()
    .filter((endpoint) => {
      return endpoint.enabled
    })
    .map((endpoint): ProviderInstance => {
      return {
        id: endpoint.id,
        kind: 'custom',
        label: endpoint.label,
        badge: endpoint.badge,
      }
    })
}

/** Provider kind behind one instance id. */
export function instanceKind(instanceId: string): ProviderKindId {
  if (instanceId === 'openrouter') {
    return 'openrouter'
  }

  if (!isNil(getEndpointSync(instanceId))) {
    return 'custom'
  }

  throw new Error(`[unplatform-ai] unknown provider instance ${instanceId}`)
}

function customVideoProvider(instanceId: string): VideoProvider {
  const endpoint = customEndpoint(instanceId)

  if (isCustomMockMode()) {
    return createCustomMockVideoProvider()
  }

  return createCustomVideoProvider(endpoint)
}

function customImageProvider(instanceId: string): ImageProvider {
  const endpoint = customEndpoint(instanceId)

  if (isCustomMockMode()) {
    return createCustomMockImageProvider()
  }

  return createCustomImageProvider(endpoint)
}

/** One configured adapter per instance id. */
export function getVideoProvider(instanceId: string = DEFAULT_INSTANCE_ID): VideoProvider {
  const existing = state.video.get(instanceId)

  if (existing) {
    return existing
  }

  let provider: VideoProvider

  if (instanceId === 'openrouter') {
    if (isMockMode()) {
      provider = createMockProvider()
    } else {
      provider = createOpenRouterProvider()
    }
  } else {
    provider = customVideoProvider(instanceId)
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

  if (instanceId !== 'openrouter') {
    const provider = customImageProvider(instanceId)

    state.image.set(instanceId, provider)

    return provider
  }

  const factory = state.imageFactories.get(instanceId)

  if (!factory) {
    throw new Error(`[unplatform-ai] no image provider registered for ${instanceId}`)
  }

  const provider = factory()

  state.image.set(instanceId, provider)

  return provider
}
