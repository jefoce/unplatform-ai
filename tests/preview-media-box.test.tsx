// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PreviewBody } from '@/features/preview/PreviewBody'

import { upload } from './helpers/validation-fixtures'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (HTMLImageElement.prototype as { decode?: () => Promise<void> }).decode
})

/** MediaBox root, the only element carrying an aspect-ratio style. */
function boxOf(container: HTMLElement): HTMLElement {
  const box = container.querySelector<HTMLElement>('[style*="aspect-ratio"]')

  if (!box) {
    throw new Error('MediaBox not rendered')
  }

  return box
}

/** jsdom writes a numeric aspect-ratio as `N / 1`. */
function ratioOf(width: number, height: number): string {
  return `${String(width / height)} / 1`
}

/** Rendered original image, the only `<img>` that is not the decorative thumb. */
function imageOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector<HTMLImageElement>('img:not([aria-hidden="true"])')

  if (!image) {
    throw new Error('Image not rendered')
  }

  return image
}

/** Cached thumb behind the full image. */
function thumbOf(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector<HTMLImageElement>('img[aria-hidden="true"]')
}

/** Holds `decode()` pending so the test controls the fade. */
function stubDecode(): () => void {
  let resolveDecode: (() => void) | undefined

  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => {
      return new Promise<void>((resolve) => {
        resolveDecode = resolve
      })
    },
  })

  return () => {
    resolveDecode?.()
  }
}

/** jsdom leaves natural sizes at zero, so tests define them before the load event. */
function defineNaturalSize(image: HTMLImageElement, width: number, height: number): void {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width })
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height })
}

describe('preview image box', () => {
  it('uses the upload size and the shared rounded box', () => {
    const item = upload('photo', 'image', { width: 1200, height: 800 })
    const { container } = render(<PreviewBody item={item} playerId="preview:photo" />)
    const box = boxOf(container)
    const image = imageOf(container)

    expect(box.style.aspectRatio).toBe(ratioOf(1200, 800))
    expect(box.classList.contains('rounded-xl')).toBe(true)
    expect(box.classList.contains('overflow-hidden')).toBe(true)
    expect(image.classList.contains('rounded-[inherit]')).toBe(true)
  })

  it('trusts the loaded natural size over the stored one', () => {
    const item = upload('rotated', 'image', { width: 1200, height: 800 })
    const { container } = render(<PreviewBody item={item} playerId="preview:rotated" />)
    const image = imageOf(container)

    expect(boxOf(container).style.aspectRatio).toBe(ratioOf(1200, 800))

    defineNaturalSize(image, 800, 1200)
    fireEvent.load(image)

    expect(boxOf(container).style.aspectRatio).toBe(ratioOf(800, 1200))
    expect(image.classList.contains('object-contain')).toBe(true)
    expect(image.classList.contains('object-cover')).toBe(false)
  })

  it('falls back to the natural size once the image loads', () => {
    const item = upload('staged', 'image')
    const { container } = render(<PreviewBody item={item} playerId="preview:staged" />)
    const image = imageOf(container)

    expect(boxOf(container).style.aspectRatio).toBe(ratioOf(16, 9))

    defineNaturalSize(image, 640, 480)
    fireEvent.load(image)

    expect(boxOf(container).style.aspectRatio).toBe(ratioOf(640, 480))
  })

  it('keeps the thumb until the image decodes, then fades the original in', async () => {
    const resolveDecode = stubDecode()
    const item = upload('faded', 'image')
    const { container } = render(<PreviewBody item={item} playerId="preview:faded" />)
    const image = imageOf(container)

    expect(thumbOf(container)).not.toBeNull()
    expect(image.getAttribute('decoding')).toBe('async')
    expect(image.classList.contains('opacity-0')).toBe(true)
    expect(image.classList.contains('opacity-100')).toBe(false)

    await act(async () => {
      resolveDecode()
    })

    expect(thumbOf(container)).toBeNull()
    expect(image.classList.contains('opacity-100')).toBe(true)
    expect(image.classList.contains('opacity-0')).toBe(false)
  })
})
