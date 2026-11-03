import type { Rule } from '../../provider-errors/types'

/** Rules every image provider shares. HTTP 402, 429 and 5xx stay in the descriptor table. */
export const IMAGE_COMMON_ERRORS: readonly Rule[] = [
  {
    match: /does not support[:\s]/i,
    title: 'This model does not support one of the settings.',
    hint: 'Remove it and try again.',
    kind: 'input',
  },
  {
    match: /unsupported (?:parameter|param|setting)|invalid parameter/i,
    title: 'This model does not support one of the settings.',
    hint: 'Remove it and try again.',
    kind: 'input',
  },
  {
    match: /insufficient (?:credits|balance)|out of credits|quota exceeded/i,
    title: 'Not enough OpenRouter credits.',
    hint: 'Top up on openrouter.ai, then try again.',
    kind: 'account',
  },
  {
    match: /rate limit|too many requests/i,
    title: 'Too many requests to OpenRouter.',
    hint: 'Wait a minute and try again.',
    kind: 'busy',
    retry: true,
  },
  {
    match: /provider (?:is )?(?:down|unavailable)|no provider|502|503|504/i,
    title: 'The model is down right now.',
    hint: 'Try again later.',
    kind: 'provider',
    retry: true,
  },
]
