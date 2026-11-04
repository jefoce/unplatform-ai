import type { Rule } from '../../../provider-errors/types'
import { IMAGE_COMMON_ERRORS } from '../../common/image-errors'

export const GEMINI_ERRORS: readonly Rule[] = [
  ...IMAGE_COMMON_ERRORS,
  {
    match: /safety|blocked because/i,
    title: 'Gemini blocked the prompt for safety.',
    hint: 'Change the prompt and try again.',
    kind: 'content',
  },
  {
    match: /prohibited/i,
    title: 'Gemini does not allow this prompt.',
    hint: 'Remove the prohibited request and try again.',
    kind: 'content',
  },
  {
    match: /recitation/i,
    title: 'Gemini blocked the result as copied material.',
    hint: 'Change the prompt or references.',
    kind: 'copyright',
  },
  {
    match:
      /(?:image|request|payload).*(?:too large|exceeds)|(?:too large|exceeds).*(?:image|request|payload)/i,
    title: 'The reference images are too large.',
    hint: 'Use fewer or smaller files.',
    kind: 'input',
  },
]
