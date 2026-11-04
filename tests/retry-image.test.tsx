// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RetryImage } from '@/ui/RetryImage'

const RETRY_DELAYS_MS = [500, 1500, 3000, 6000, 10_000, 10_000]

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

  it('keeps the image visible after three failures and a later load', () => {
    const { container } = render(
      <RetryImage src="/thumb.jpg" alt="" placeholder={<span data-testid="placeholder" />} />,
    )

    for (const delay of RETRY_DELAYS_MS.slice(0, 3)) {
      fireEvent.error(imageOf(container))

      act(() => {
        vi.advanceTimersByTime(delay)
      })
    }

    expect(imageOf(container).getAttribute('src')).toBe('/thumb.jpg?r=3')

    fireEvent.load(imageOf(container))

    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('[data-testid="placeholder"]')).toBeNull()
  })

  it('shows the placeholder only after the last retry fails', () => {
    const { container } = render(
      <RetryImage src="/thumb.jpg" alt="" placeholder={<span data-testid="placeholder" />} />,
    )

    for (const delay of RETRY_DELAYS_MS) {
      fireEvent.error(imageOf(container))

      act(() => {
        vi.advanceTimersByTime(delay)
      })
    }

    fireEvent.error(imageOf(container))

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-testid="placeholder"]')).not.toBeNull()
  })

  it('retries a 503 response with Retry-After instead of showing the placeholder', () => {
    const { container } = render(
      <RetryImage src="/thumb.jpg" alt="" placeholder={<span data-testid="placeholder" />} />,
    )

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(imageOf(container).getAttribute('src')).toBe('/thumb.jpg?r=1')
    expect(container.querySelector('[data-testid="placeholder"]')).toBeNull()
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

  it('resets the backoff after a source change', () => {
    const { container, rerender } = render(<RetryImage src="/first.jpg" alt="" />)

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    rerender(<RetryImage src="/second.jpg" alt="" />)
    fireEvent.error(imageOf(container))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(imageOf(container).getAttribute('src')).toBe('/second.jpg?r=1')
  })
})
