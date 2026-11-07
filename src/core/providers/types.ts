import type { HttpRuleTable } from '../provider-errors/types'
import type { SecretName } from '../secret-names'

/** Base URL of the user guides on GitHub, resolved on the default branch. */
export const GUIDE_BASE = 'https://github.com/jefoce/unplatform-ai/blob/HEAD/docs/user'

export const PROVIDER_KIND_IDS = ['openrouter', 'custom'] as const

export type ProviderKindId = (typeof PROVIDER_KIND_IDS)[number]

/** @deprecated Use PROVIDER_KIND_IDS. Kept for one version. */
export const PROVIDER_IDS = PROVIDER_KIND_IDS

/* eslint-disable no-restricted-syntax -- deprecated alias kept for one version after the worker migration */
/** @deprecated Use ProviderKindId. */
export type ProviderId = ProviderKindId
/* eslint-enable no-restricted-syntax */

export interface ProviderKind {
  id: ProviderKindId
  title: string
  multiple: boolean
  dynamic: boolean
  local: boolean
  video: boolean
  image: boolean
}

export const PROVIDER_KINDS = {
  openrouter: {
    id: 'openrouter',
    title: 'OpenRouter',
    multiple: false,
    dynamic: false,
    local: false,
    video: true,
    image: true,
  },
  custom: {
    id: 'custom',
    title: 'ComfyUI',
    multiple: true,
    dynamic: true,
    local: true,
    video: true,
    image: true,
  },
} as const satisfies Record<ProviderKindId, ProviderKind>

export interface ProviderInstance {
  id: string
  kind: ProviderKindId
  label: string
  badge: string | null
}

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

export interface ProviderDescriptor {
  id: ProviderKindId
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
