// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { HistoryTile } from '@/features/history/list/HistoryTile'
import { ImageTileMedia } from '@/features/history/list/ImageTileMedia'

import { handleNoop } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const thumbWidth = (src: string): number => {
  return Number(new URL(src, 'http://localhost').searchParams.get('w'))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('image tile thumb', () => {
  it('retries a failed thumb and renders the retry', () => {
    vi.useFakeTimers()

    const [image] = imageItemsOf(['a'])
    const item = required(image, 'image item')

    const { container } = render(
      <ImageTileMedia item={item} thumbSrc={item.thumbSrc} isCompleted radius="rounded-none" />,
    )

    fireEvent.error(required(container.querySelector('img'), 'thumb'))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    const retried = required(container.querySelector('img'), 'retried thumb')

    expect(retried.getAttribute('src')).toContain('r=1')
  })

  it('requests a wider thumb when the zoom step grows', () => {
    const [image] = imageItemsOf(['a'])

    const view = render(
      <HistoryTile item={required(image, 'image')} zoom={0} onOpen={handleNoop} mediaWidth={0} />,
    )

    const small = required(view.container.querySelector('img'), 'small thumb').getAttribute('src')

    view.rerender(
      <HistoryTile item={required(image, 'image')} zoom={5} onOpen={handleNoop} mediaWidth={0} />,
    )

    const large = required(view.container.querySelector('img'), 'large thumb').getAttribute('src')

    expect(thumbWidth(required(small, 'small src'))).toBeGreaterThan(0)

    expect(thumbWidth(required(large, 'large src'))).toBeGreaterThan(
      thumbWidth(required(small, 'small src')),
    )
  })
})
