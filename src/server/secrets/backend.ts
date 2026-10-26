import 'server-only'

import { isNil } from 'lodash-es'

import type { SecretName } from '@/core/secret-names'

import { sessionRequired } from '../session'
import { bridgeBackend, KeychainUnavailableError } from './bridge'
import { fileBackend } from './file'
import { keychainBackend } from './keychain'
import type { SecretBackend } from './types'

/** UPAI_SECRETS_BACKEND=file is a development escape, not a production backend on macOS or Windows. */
function wantsFileBackend(): boolean {
  if (process.env.UPAI_SECRETS_BACKEND?.trim() !== 'file') {
    return false
  }

  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  if (process.platform === 'linux') {
    return true
  }

  console.warn(
    '[unplatform-ai] UPAI_SECRETS_BACKEND=file is ignored in production on macOS and Windows',
  )

  return false
}

export async function pickBackend(): Promise<SecretBackend> {
  if (wantsFileBackend()) {
    return fileBackend()
  }

  if (sessionRequired()) {
    return bridgeBackend()
  }

  const backend = await keychainBackend()

  if (!isNil(backend)) {
    return backend
  }

  if (process.platform === 'linux') {
    return fileBackend()
  }

  throw new KeychainUnavailableError()
}

export interface LoadedBackend {
  backend: SecretBackend
  stored: Partial<Record<SecretName, string>>
}

/** Linux keeps a 0600 file fallback. macOS and Windows fail loudly instead. */
export async function readStored(backend: SecretBackend): Promise<LoadedBackend> {
  try {
    return { backend, stored: await backend.getAll() }
  } catch (error) {
    if (!(error instanceof KeychainUnavailableError)) {
      throw error
    }

    if (process.platform !== 'linux') {
      throw error
    }

    const fallback = fileBackend()

    return { backend: fallback, stored: await fallback.getAll() }
  }
}
