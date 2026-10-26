import 'server-only'

import { isNil } from 'lodash-es'

import { isMockMode } from '../config/mock-mode'
import { globalState } from '../global-state'
import { onSecretsChange } from '../secrets'
import { createMockStore } from './mock-store'
import { r2Config } from './r2'
import { createS3Store } from './s3-store'
import type { ObjectStore } from './types'

const cache = globalState('objectStore', () => {
  return {
    value: undefined as ObjectStore | null | undefined,
  }
})

/** Mock wins only in mock provider mode, then complete R2 config, else null. */
export function getObjectStore(): ObjectStore | null {
  if (!isNil(cache.value)) {
    return cache.value
  }

  if ((process.env.REMOTE_MOCK?.trim() ?? '') !== '') {
    if (isMockMode()) {
      cache.value = createMockStore()
    } else {
      console.warn(
        '[unplatform-ai] REMOTE_MOCK ignored: real OpenRouter cannot fetch 127.0.0.1 links',
      )
    }
  }

  if (isNil(cache.value)) {
    const config = r2Config()

    if (!isNil(config)) {
      cache.value = createS3Store(config)
    }
  }

  cache.value ??= null

  return cache.value
}

onSecretsChange(() => {
  cache.value = undefined
})
