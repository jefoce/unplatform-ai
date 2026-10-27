// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MediaBox } from '@/ui/MediaBox'

import { required } from './helpers/required'

afterEach(() => {
  cleanup()
})

function box(aspect: string): HTMLElement {
  const { container } = render(
    <MediaBox aspect={aspect}>
      <div />
    </MediaBox>,
  )

  return required(container.firstElementChild, 'media box') as HTMLElement
}

describe('MediaBox', () => {
  // jsdom folds the ratio calc into a single container unit.
  it('sizes a square box to the smaller stage side', () => {
    const element = box('1/1')

    expect(element.style.width).toBe('min(100cqw, 100cqh)')
    expect(element.style.aspectRatio).toBe('1/1')
    expect(element.style.height).toBe('auto')
  })

  it('sizes a wide aspect from the stage height', () => {
    const element = box('2/1')

    expect(element.style.width).toBe('min(100cqw, 200cqh)')
    expect(element.classList.contains('w-full')).toBe(false)
  })

  it('sizes a tall aspect from the stage width', () => {
    const element = box('1/2')

    expect(element.style.width).toBe('min(100cqw, 50cqh)')
    expect(element.classList.contains('h-full')).toBe(false)
  })

  it('clips the media inside a rounded, bounded box', () => {
    const element = box('1920/1080')

    expect(element.className).toContain('rounded-xl')
    expect(element.className).toContain('overflow-hidden')
    expect(element.className).toContain('max-h-full')
    expect(element.className).toContain('max-w-full')
  })
})
