import { R2_NAMES } from '../secret-names'
import { GUIDE_BASE, type StorageProviderDescriptor } from './types'

export const R2_DESCRIPTOR = {
  id: 'r2',
  label: 'Cloudflare R2',
  fields: [
    {
      name: 'R2_ACCOUNT_ID',
      label: 'Account ID',
      placeholder: '',
      isSecret: true,
      hint: null,
    },
    {
      name: 'R2_ACCESS_KEY_ID',
      label: 'Access key ID',
      placeholder: '',
      isSecret: true,
      hint: null,
    },
    {
      name: 'R2_SECRET_ACCESS_KEY',
      label: 'Secret access key',
      placeholder: '',
      isSecret: true,
      hint: null,
    },
    {
      name: 'R2_BUCKET',
      label: 'Bucket',
      placeholder: '',
      isSecret: false,
      hint: null,
    },
  ],
  requiredSecrets: R2_NAMES,
  links: [
    { label: 'Buckets', url: 'https://dash.cloudflare.com/?to=/:account/r2/overview' },
    { label: 'API tokens', url: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens' },
    { label: 'Setup guide', url: `${GUIDE_BASE}/CLOUDFLARE-R2.md` },
  ],
} satisfies StorageProviderDescriptor
