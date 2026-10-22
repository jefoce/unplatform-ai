import type { SecretName } from './use-secrets'

export interface SecretChange {
  value?: string
  remove?: boolean
}

export interface SecretFieldDef {
  name: SecretName
  label: string
  hint?: string
}

export const OPENROUTER_FIELDS = [
  { name: 'OPENROUTER_API_KEY', label: 'API key' },
  { name: 'OPENROUTER_MANAGEMENT_KEY', label: 'Management key', hint: 'optional, shows balance' },
] satisfies SecretFieldDef[]

export const R2_FIELDS = [
  { name: 'R2_ACCOUNT_ID', label: 'Account ID' },
  { name: 'R2_ACCESS_KEY_ID', label: 'Access key ID' },
  { name: 'R2_SECRET_ACCESS_KEY', label: 'Secret access key' },
  { name: 'R2_BUCKET', label: 'Bucket' },
] satisfies SecretFieldDef[]
