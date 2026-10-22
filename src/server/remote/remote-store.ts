import 'server-only'

import { isNil } from 'lodash-es'

import { globalState } from '../global-state'
import { isMockMode } from '../openrouter/client'
import { getSecret, onSecretsChange } from '../secrets'
import { createMockStore } from './mock'
import { createR2Store } from './r2'

export interface RemoteObjectInfo {
  key: string
  size: number
  serverSha256: string | null
}

export interface RemotePutOptions {
  contentType: string
  sha256: string
  onProgress?: (sent: number, total: number) => void
}

export interface RemotePutParams {
  key: string
  file: string
  opts: RemotePutOptions
}

export interface RemotePresignParams {
  key: string
  ttlSec: number
  contentType: string
}

export interface RemoteStore {
  head(key: string): Promise<RemoteObjectInfo | null>
  put(params: RemotePutParams): Promise<RemoteObjectInfo>
  presign(params: RemotePresignParams): Promise<string>
  delete(key: string): Promise<void>
}

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const

const cache = globalState('remoteStore', () => ({
  value: undefined as RemoteStore | null | undefined,
}))

/** Mock wins only in mock provider mode, then complete R2 config, else null. */
export function getRemoteStore(): RemoteStore | null {
  if (!isNil(cache.value)) return cache.value

  if ((process.env.REMOTE_MOCK?.trim() ?? '') !== '') {
    if (isMockMode()) cache.value = createMockStore()
    else
      console.warn(
        '[unplatform-ai] REMOTE_MOCK ignored: real OpenRouter cannot fetch 127.0.0.1 links',
      )
  }

  if (isNil(cache.value) && R2_KEYS.every((key) => Boolean(getSecret(key)))) {
    cache.value = createR2Store()
  }

  cache.value ??= null

  return cache.value
}

onSecretsChange(() => {
  cache.value = undefined
})
