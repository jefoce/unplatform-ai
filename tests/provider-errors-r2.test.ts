import { describe, expect, it } from 'vitest'

import { friendlyError } from '@/core/provider-errors'
import { r2TestText } from '@/core/provider-errors/r2'

const ROWS: Array<{ raw: string; title: string; hint: string }> = [
  {
    raw: 'r2:401:UnknownError',
    title: 'R2 rejected the key.',
    hint: 'Check the R2 access key and secret in Settings.',
  },
  {
    raw: 'r2:403:AccessDenied',
    title: 'R2 rejected the key.',
    hint: 'Check the R2 access key and secret in Settings.',
  },
  {
    raw: 'r2:404:NoSuchBucket',
    title: 'R2 bucket not found.',
    hint: 'Check the bucket name in Settings.',
  },
  {
    raw: 'r2:network:ECONNREFUSED',
    title: "Can't reach R2.",
    hint: 'Check your connection.',
  },
  {
    raw: 'r2:500:InternalError',
    title: 'Cloud storage rejected the upload.',
    hint: 'Check the R2 settings.',
  },
]

describe('friendlyError R2', () => {
  it.each(ROWS)('maps $raw', ({ raw, title, hint }) => {
    const friendly = friendlyError({ httpRules: null, raw, rules: [] })

    expect(friendly.title).toBe(title)
    expect(friendly.hint).toBe(hint)
  })

  it('does not show the raw SDK error name for a failed upload', () => {
    const friendly = friendlyError({ httpRules: null, raw: 'r2:401:UnknownError', rules: [] })

    expect(friendly.title).toBe('R2 rejected the key.')
    expect(friendly.title).not.toBe('UnknownError')
  })
})

describe('r2TestText', () => {
  it.each(ROWS)('joins the title and hint for $raw', ({ raw, title, hint }) => {
    expect(r2TestText(raw)).toBe(`${title} ${hint}`)
  })

  it('returns null for a non-R2 string', () => {
    expect(r2TestText('OpenRouter auth failed')).toBeNull()
  })
})
