import { describe, expect, it } from 'vitest'

import { MAX_FAVORITE_EPOCHS } from '@/core/constants'
import { favoriteChangedSince, markFavoriteChange } from '@/lib/favorite-epoch'

describe('favorite epochs', () => {
  it('evicts the oldest id once the cap is passed', () => {
    markFavoriteChange('oldest')

    for (let index = 0; index < MAX_FAVORITE_EPOCHS; index += 1) {
      markFavoriteChange(`new-${String(index)}`)
    }

    const newest = `new-${String(MAX_FAVORITE_EPOCHS - 1)}`

    expect(favoriteChangedSince('oldest', 0)).toBe(false)
    expect(favoriteChangedSince(newest, 0)).toBe(true)
  })
})
