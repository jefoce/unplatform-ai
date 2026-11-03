// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { CardAction } from '@/features/history/actions/card-action'
import { FavoriteBadge } from '@/features/history/actions/FavoriteBadge'
import { imageCardActions } from '@/features/history/actions/image-card-actions'
import { videoCardActions } from '@/features/history/actions/video-card-actions'
import { HistoryFilterForm } from '@/features/history/filters/HistoryFilterForm'
import { ImageFilterForm } from '@/features/workspace/ImageFilterForm'

import { videoItem } from '../src/lib/feed/output-items'
import { record } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

afterEach(cleanup)

function cardLabel(actions: readonly CardAction[], key: string): string {
  const action = required(
    actions.find((entry) => {
      return entry.key === key
    }),
    `${key} action`,
  )

  return action.label
}

describe('Liked wording', () => {
  it('labels both filters as Liked only', () => {
    const history = render(<HistoryFilterForm />)

    expect(screen.getByText('Liked only')).not.toBeNull()

    history.unmount()
    render(<ImageFilterForm />)

    expect(screen.getByText('Liked only')).not.toBeNull()
  })

  it('labels liked card actions as Liked', () => {
    const [image] = imageItemsOf(['liked-output'], true)

    expect(cardLabel(imageCardActions(required(image, 'image item')), 'favorite')).toBe('Liked')

    expect(
      cardLabel(videoCardActions(videoItem(record('v', { favorite: true }))), 'favorite'),
    ).toBe('Liked')
  })

  it('labels the liked badge as Liked', () => {
    render(<FavoriteBadge isFavorite onToggle={() => {}} />)

    expect(screen.getByRole('button', { name: 'Liked' })).not.toBeNull()
  })
})
