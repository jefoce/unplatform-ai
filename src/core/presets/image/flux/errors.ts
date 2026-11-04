import type { Rule } from '../../../provider-errors/types'
import { IMAGE_COMMON_ERRORS } from '../../common/image-errors'

export const FLUX_ERRORS: readonly Rule[] = [
  ...IMAGE_COMMON_ERRORS,
  {
    match: /safety_tolerance|moderation|flagged/i,
    title: 'FLUX moderation blocked this request.',
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match: /invalid.*size|size.*invalid/i,
    title: 'FLUX does not accept this image size.',
    hint: 'Pick another resolution or ratio.',
    kind: 'input',
  },
]
