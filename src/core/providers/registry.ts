import { isNil } from 'lodash-es'

import { OPENROUTER_DESCRIPTOR } from './openrouter'
import { R2_DESCRIPTOR } from './r2'
import {
  type StorageProviderDescriptor,
  type StorageProviderId,
  type VideoProviderDescriptor,
  type VideoProviderId,
} from './types'

/** @public */
export const VIDEO_PROVIDERS: readonly VideoProviderDescriptor[] = [OPENROUTER_DESCRIPTOR]

/** @public */
export const STORAGE_PROVIDERS: readonly StorageProviderDescriptor[] = [R2_DESCRIPTOR]

export function videoProviderDescriptor(id: VideoProviderId): VideoProviderDescriptor {
  const descriptor = VIDEO_PROVIDERS.find((provider) => {
    return provider.id === id
  })

  if (isNil(descriptor)) {
    throw new Error(`Unknown video provider: ${id}`)
  }

  return descriptor
}

/** @public */
export function storageProviderDescriptor(id: StorageProviderId): StorageProviderDescriptor {
  const descriptor = STORAGE_PROVIDERS.find((provider) => {
    return provider.id === id
  })

  if (isNil(descriptor)) {
    throw new Error(`Unknown storage provider: ${id}`)
  }

  return descriptor
}
