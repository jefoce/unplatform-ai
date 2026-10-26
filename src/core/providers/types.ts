import type { HttpRuleTable } from '../provider-errors/types'
import type { SecretName } from '../secret-names'

/** Base URL of the user guides on GitHub, resolved on the default branch. */
export const GUIDE_BASE = 'https://github.com/jefoce/unplatform-ai/blob/HEAD/docs/user'

/** @public */
export const VIDEO_PROVIDER_IDS = ['openrouter'] as const

export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number]

/** @public */
export const STORAGE_PROVIDER_IDS = ['r2'] as const

export type StorageProviderId = (typeof STORAGE_PROVIDER_IDS)[number]

/** @public */
export interface ProviderSecretField {
  name: SecretName
  label: string
  placeholder: string
  isSecret: boolean
  hint: string | null
}

/** @public */
export interface ProviderLink {
  label: string
  url: string
}

export interface VideoProviderDescriptor {
  id: VideoProviderId
  label: string
  fields: readonly ProviderSecretField[]
  requiredSecrets: readonly SecretName[]
  links: readonly ProviderLink[]
  httpRules: HttpRuleTable
}

export interface StorageProviderDescriptor {
  id: StorageProviderId
  label: string
  fields: readonly ProviderSecretField[]
  requiredSecrets: readonly SecretName[]
  links: readonly ProviderLink[]
}
