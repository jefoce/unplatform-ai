// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HistoryModalMedia } from '@/features/history/list/HistoryModalMedia'

import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const OUTPUT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3401'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const base = required(imageItemsOf([OUTPUT_ID])[0], 'image item')

function renderMedia(item: typeof base) {
  const { container } = render(
    <HistoryModalMedia
      item={item}
      nav={{ hasPrevious: false, hasNext: false, onPrevious: vi.fn(), onNext: vi.fn() }}
      toolbar={null}
      backdrop={{ kind: 'gradient', seed: item.id }}
      onCancel={vi.fn()}
    />,
  )

  const box = required(container.querySelector<HTMLElement>('[style*="aspect-ratio"]'), 'media box')
  const image = required(box.querySelector('img'), 'image')

  return { box, image }
}

function ratioOf(width: number, height: number): string {
  return `${String(width / height)} / 1`
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('viewer image box', () => {
  it.each([
    ['3:2', 1024, 768],
    ['portrait', 768, 1024],
    ['landscape', 1600, 900],
  ])('matches a %s image and covers it', (_, width, height) => {
    const item = { ...base, width, height }
    const { box, image } = renderMedia(item)

    expect(box.style.aspectRatio).toBe(ratioOf(width, height))
    expect(box.className).toContain('rounded-xl')
    expect(image.className).toContain('size-full')
    expect(image.className).toContain('object-cover')
    expect(image.getAttribute('alt')).toBe(item.prompt)
  })
})
