'use client'

import { isEmpty, isNil } from 'lodash-es'

import type { CreditsInfo } from '@/core/types'

interface KeyLimitHintProps {
  credits: CreditsInfo | undefined
}

/** Quiet warning when the loaded OpenRouter key has no spend limit. */
export function KeyLimitHint(props: KeyLimitHintProps) {
  const { credits } = props

  if (isNil(credits) || !isEmpty(credits.error) || !isNil(credits.keyLimit)) {
    return null
  }

  if (credits.source !== 'key' && credits.source !== 'management') {
    return null
  }

  return (
    <p className="text-xxs text-fg-2">
      This key has no spend limit. Set one on OpenRouter, so a leaked key can&apos;t cost more than
      you allow.
    </p>
  )
}
