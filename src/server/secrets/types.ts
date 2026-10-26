import type { SecretName } from '@/core/secret-names'
import type { SecretSource } from '@/core/types'

export interface SecretBackend {
  kind: Exclude<SecretSource, 'env'>
  getAll(): Promise<Partial<Record<SecretName, string>>>
  get(name: SecretName): Promise<string | null>
  set(name: SecretName, value: string): Promise<void>
  remove(name: SecretName): Promise<void>
}
