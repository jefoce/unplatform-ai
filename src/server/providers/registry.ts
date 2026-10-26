import 'server-only'

import { VIDEO_PROVIDER_IDS, type VideoProviderId } from '@/core/providers/types'

import { isMockMode } from '../config/mock-mode'
import { createMockProvider } from './mock/provider'
import { createOpenRouterProvider } from './openrouter/provider'
import type { VideoProvider } from './types'

const DEFAULT_PROVIDER_ID: VideoProviderId = VIDEO_PROVIDER_IDS[0]

const providers = new Map<VideoProviderId, VideoProvider>()

type VideoProviderFactory = () => VideoProvider

const FACTORIES: Record<VideoProviderId, VideoProviderFactory> = {
  openrouter: createOpenRouterProvider,
}

/** True when the registry selects the mock adapter for this provider. */
function isMockProvider(id: VideoProviderId): boolean {
  return id === 'openrouter' && isMockMode()
}

/** One configured adapter per provider id. */
export function getVideoProvider(id: VideoProviderId = DEFAULT_PROVIDER_ID): VideoProvider {
  const existing = providers.get(id)

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

  providers.set(id, provider)

  return provider
}
