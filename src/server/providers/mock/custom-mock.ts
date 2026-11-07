import 'server-only'

import type { ImageProvider, VideoProvider } from '../types'
import { createMockImageProvider } from './images'
import { createMockProvider } from './provider'

/** Minimal upai stub for CUSTOM_ENDPOINT_MOCK=1. w-mock replaces it with fixtures. */
export function createCustomMockVideoProvider(): VideoProvider {
  return { ...createMockProvider(), id: 'custom', contentHosts: [] }
}

export function createCustomMockImageProvider(): ImageProvider {
  return { ...createMockImageProvider(), id: 'custom' }
}
