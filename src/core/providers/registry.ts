import { isNil } from 'lodash-es'

import { OPENROUTER_DESCRIPTOR } from './openrouter'
import { R2_DESCRIPTOR } from './r2'
import {
  type ProviderDescriptor,
  type ProviderId,
  type StorageProviderDescriptor,
  type StorageProviderId,
} from './types'

/** @public */
export const PROVIDERS: readonly ProviderDescriptor[] = [OPENROUTER_DESCRIPTOR]

/** @public */
export const STORAGE_PROVIDERS: readonly StorageProviderDescriptor[] = [R2_DESCRIPTOR]

export function providerDescriptor(id: ProviderId): ProviderDescriptor {
  const descriptor = PROVIDERS.find((provider) => {
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
