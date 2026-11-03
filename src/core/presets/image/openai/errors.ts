import type { Rule } from '../../../provider-errors/types'
import { IMAGE_COMMON_ERRORS } from '../../common/image-errors'

export const OPENAI_ERRORS: readonly Rule[] = [
  ...IMAGE_COMMON_ERRORS,
  {
    match: /moderation_blocked|moderation/i,
    title: 'OpenAI moderation blocked this request.',
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match: /content[_ ]policy|violates.*policy/i,
    title: 'OpenAI content policy blocked this request.',
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match:
      /(?:quality|size).*(?:invalid|not supported|combination)|(?:invalid|not supported).*(?:quality|size)/i,
    title: 'This quality and size combination is not supported.',
    hint: 'Pick another quality or size.',
    kind: 'input',
  },
]
