import type { Rule } from '../../../provider-errors/types'
import { IMAGE_COMMON_ERRORS } from '../../common/image-errors'

export const SEEDREAM_ERRORS: readonly Rule[] = [
  ...IMAGE_COMMON_ERRORS,
  {
    match: /Input(?:Image|Video|Audio|Text)?SensitiveContentDetected|sensitive content/i,
    title: "Seedream's content check flagged this request.",
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match: /input.*(?:detect|inspect)|(?:detect|inspect).*input/i,
    title: "Seedream's input check rejected a reference.",
    hint: 'Replace it and try again.',
    kind: 'input',
  },
  {
    match: /invalid.*(?:image )?size|(?:image )?size.*invalid/i,
    title: 'Seedream does not accept this image size.',
    hint: 'Pick another resolution or ratio.',
    kind: 'input',
  },
]
