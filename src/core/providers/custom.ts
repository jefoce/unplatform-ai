import { GUIDE_BASE, type ProviderDescriptor } from './types'

export const CUSTOM_DESCRIPTOR = {
  id: 'custom',
  label: 'ComfyUI',
  fields: [],
  requiredSecrets: [],
  links: [{ label: 'Setup guide', url: `${GUIDE_BASE}/COMFYUI.md` }],
  httpRules: {},
} satisfies ProviderDescriptor
