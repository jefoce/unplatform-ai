// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
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
})

/** MediaBox root, the only element carrying an aspect-ratio style. */
function boxOf(container: HTMLElement): HTMLElement {
  const box = container.querySelector<HTMLElement>('[style*="aspect-ratio"]')

  if (!box) {
    throw new Error('MediaBox not rendered')
  }

  return box
}

/** Rendered original image, the only `<img>` in the box. */
function imageOf(container: HTMLElement): HTMLImageElement {
  const image = container.querySelector('img')

  if (!image) {
    throw new Error('Image not rendered')
  }

  return image
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

    expect(box.style.aspectRatio).toBe('1200/800')
    expect(box.classList.contains('rounded-xl')).toBe(true)
    expect(box.classList.contains('overflow-hidden')).toBe(true)
    expect(image.classList.contains('rounded-[inherit]')).toBe(true)
  })

  it('trusts the loaded natural size over the stored one', () => {
    const item = upload('rotated', 'image', { width: 1200, height: 800 })
    const { container } = render(<PreviewBody item={item} playerId="preview:rotated" />)
    const image = imageOf(container)

    expect(boxOf(container).style.aspectRatio).toBe('1200/800')

    defineNaturalSize(image, 800, 1200)
    fireEvent.load(image)

    expect(boxOf(container).style.aspectRatio).toBe('800/1200')
    expect(image.classList.contains('object-contain')).toBe(true)
    expect(image.classList.contains('object-cover')).toBe(false)
  })

  it('falls back to the natural size once the image loads', () => {
    const item = upload('staged', 'image')
    const { container } = render(<PreviewBody item={item} playerId="preview:staged" />)
    const image = imageOf(container)

    expect(boxOf(container).style.aspectRatio).toBe('16/9')

    defineNaturalSize(image, 640, 480)
    fireEvent.load(image)

    expect(boxOf(container).style.aspectRatio).toBe('640/480')
  })

  it('fades the image in only after it loads', () => {
    const item = upload('faded', 'image')
    const { container } = render(<PreviewBody item={item} playerId="preview:faded" />)
    const image = imageOf(container)

    expect(image.classList.contains('opacity-0')).toBe(true)
    expect(image.classList.contains('opacity-100')).toBe(false)

    defineNaturalSize(image, 640, 480)
    fireEvent.load(image)

    expect(image.classList.contains('opacity-100')).toBe(true)
    expect(image.classList.contains('opacity-0')).toBe(false)
  })
})
