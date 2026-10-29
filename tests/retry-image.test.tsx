// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RetryImage } from '@/ui/RetryImage'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function imageOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector('img')

  if (!image) {
    throw new Error('Image not rendered')
  }

  return image
}

describe('RetryImage', () => {
  it('an error then a success shows the image and the success URL is the retry URL', () => {
    const { container } = render(<RetryImage src="/api/thumbs/a?w=32" alt="" />)

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(imageOf(container).getAttribute('src')).toBe('/api/thumbs/a?w=32&r=1')
  })

  it('three errors show the placeholder', () => {
    const { container } = render(
      <RetryImage src="/thumb.jpg" alt="" placeholder={<span data-testid="placeholder" />} />,
    )

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    fireEvent.error(imageOf(container))

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-testid="placeholder"]')).not.toBeNull()
  })

  it('the retry URL carries r=1, then r=2', () => {
    const { container } = render(<RetryImage src="/thumb.jpg" alt="" />)

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(imageOf(container).getAttribute('src')).toBe('/thumb.jpg?r=1')

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(imageOf(container).getAttribute('src')).toBe('/thumb.jpg?r=2')
  })
})
