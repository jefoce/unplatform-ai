import { Heart } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { CardAction } from '../src/features/history/actions/card-action'
import { fitCompactActions } from '../src/features/history/actions/card-actions-fit'

const action = (key: string): CardAction => {
  return {
    key,
    label: key,
    icon: Heart,
    onSelect: () => {},
  }
}

const keysOf = (actions: readonly CardAction[]): string[] => {
  return actions.map((entry) => {
    return entry.key
  })
}

describe('fitCompactActions', () => {
  it('keeps a short list that already fits', () => {
    const actions = [action('favorite'), action('download'), action('reference')]

    expect(keysOf(fitCompactActions({ actions, height: 150 }))).toEqual([
      'favorite',
      'download',
      'reference',
    ])
  })

  it('drops download and reference before the rest', () => {
    const actions = [
      action('favorite'),
      action('download'),
      action('reference'),
      action('use'),
      action('regenerate'),
    ]

    expect(keysOf(fitCompactActions({ actions, height: 150 }))).toEqual([
      'favorite',
      'use',
      'regenerate',
    ])
  })

  it('falls back to the favorite when even the short list is too tall', () => {
    const actions = [action('download'), action('favorite'), action('reference')]

    expect(keysOf(fitCompactActions({ actions, height: 40 }))).toEqual(['favorite'])
  })
})
