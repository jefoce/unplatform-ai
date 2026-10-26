import { isNil } from 'lodash-es'
import { vi } from 'vitest'

import type { SecretName } from '@/core/secret-names'

export interface Backend {
  kind: 'file'
  store: Map<string, string>
  getAll(): Promise<Partial<Record<SecretName, string>>>
  get(name: SecretName): Promise<string | null>
  set(name: SecretName, value: string): Promise<void>
  remove(name: SecretName): Promise<void>
}

export function memoryBackend(values: Partial<Record<SecretName, string>> = {}): Backend {
  const store = new Map<string, string>()

  for (const [name, value] of Object.entries(values)) {
    if (!isNil(value)) {
      store.set(name, value)
    }
  }

  return {
    kind: 'file',
    store,
    getAll: async () => {
      return Object.fromEntries(store)
    },
    get: async (name) => {
      return store.get(name) ?? null
    },
    set: async (name, value) => {
      store.set(name, value)
    },
    remove: async (name) => {
      store.delete(name)
    },
  }
}

export async function setup(backend = memoryBackend()) {
  vi.resetModules()
  const secrets = await import('@/server/secrets')

  secrets.__resetSecretsForTests()
  secrets.__setSecretsBackendForTests(backend)
  await secrets.secretsReady()

  return { secrets, backend }
}
