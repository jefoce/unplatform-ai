import { describe, expect, it } from 'vitest'

import { FEED_SCROLL_THRESHOLD_PX, isFeedScrolled } from '@/features/history/list/feed-scroll'

describe('isFeedScrolled', () => {
  it('stays at rest through the 8 px threshold', () => {
    expect(isFeedScrolled(0)).toBe(false)
    expect(isFeedScrolled(FEED_SCROLL_THRESHOLD_PX)).toBe(false)
    expect(isFeedScrolled(FEED_SCROLL_THRESHOLD_PX + 1)).toBe(true)
  })
})
