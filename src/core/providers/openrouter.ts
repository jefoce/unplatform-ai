import { GUIDE_BASE, type VideoProviderDescriptor } from './types'

export const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/settings/credits'

export const OPENROUTER_DESCRIPTOR = {
  id: 'openrouter',
  label: 'OpenRouter',
  fields: [
    {
      name: 'OPENROUTER_API_KEY',
      label: 'API key',
      placeholder: 'sk-or-v1-...',
      isSecret: true,
      hint: 'Keys usually start with sk-or-',
    },
    {
      name: 'OPENROUTER_MANAGEMENT_KEY',
      label: 'Management key',
      placeholder: '',
      isSecret: true,
      hint: 'optional, shows balance',
    },
  ],
  requiredSecrets: ['OPENROUTER_API_KEY'],
  links: [
    { label: 'API keys', url: 'https://openrouter.ai/workspaces/default/keys' },
    { label: 'Management keys', url: 'https://openrouter.ai/settings/management-keys' },
    { label: 'Credits', url: OPENROUTER_CREDITS_URL },
    { label: 'Setup guide', url: `${GUIDE_BASE}/OPENROUTER.md` },
  ],
  httpRules: {
    400: {
      title: 'OpenRouter rejected the request.',
      hint: 'Send the details to the developer.',
      kind: 'input',
    },
    401: {
      title: 'Your OpenRouter key is not valid.',
      hint: 'Open Settings and paste a new key.',
      kind: 'account',
    },
    402: {
      title: 'Not enough OpenRouter credits.',
      hint: 'Top up on openrouter.ai, then try again.',
      kind: 'account',
    },
    403: {
      title: 'Flagged by moderation.',
      hint: 'Change the prompt or references.',
      kind: 'content',
    },
    408: {
      title: 'OpenRouter timed out.',
      hint: 'Try again.',
      kind: 'provider',
      retry: true,
    },
    429: {
      title: 'Too many requests to OpenRouter.',
      hint: 'Wait a minute and try again.',
      kind: 'busy',
      retry: true,
    },
    502: {
      title: 'The model is down right now.',
      hint: 'Try again later.',
      kind: 'provider',
      retry: true,
    },
    503: {
      title: 'No provider can run this request right now.',
      hint: 'Try again later.',
      kind: 'provider',
      retry: true,
    },
  },
} satisfies VideoProviderDescriptor
