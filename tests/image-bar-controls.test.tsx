// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ImagePromptControls } from '@/features/image-generator/ImagePromptControls'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { SEEDREAM_5_FLASH } from '../src/core/presets/image/seedream/seedream-5-0-flash'
import { Observer } from './helpers/history'
import { required } from './helpers/required'

vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
  }
})

vi.mock('@/lib/api/catalog', () => {
  return {
    useCatalog: () => {
      return { catalog: undefined, isLoading: false, isValidating: false }
    },
    refreshCatalog: vi.fn(async () => {}),
    useModelEntry: () => {
      return null
    },
  }
})

const PRESET = SEEDREAM_5_FLASH

function handleSubmit(): void {}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  Range.prototype.getBoundingClientRect = () => {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
  }

  Range.prototype.getClientRects = () => {
    return {
      length: 0,
      item: () => {
        return null
      },
    } as unknown as DOMRectList
  }

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })

  useImageGeneratorStore.setState({
    presetId: SEEDREAM_5_FLASH.id,
    prompt: '',
    count: 1,
    seed: null,
    aspectRatio: '1:1',
    resolution: '1K',
    quality: null,
    background: null,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('image bar controls', () => {
  it('gives every control the same height, background and text size', () => {
    const { container } = render(
      <ImagePromptControls preset={PRESET} onSubmit={handleSubmit} warnings={[]} />,
    )

    const row = required(container.querySelector('[data-image-controls]'), 'image control row')

    const controls = Array.from(row.children).filter((node) => {
      return node.tagName !== 'SPAN'
    })

    expect(controls.length).toBe(7)
    expect(screen.getByRole('button', { name: 'Add references' })).toBe(controls[0])
    expect(controls).toContain(screen.getByRole('button', { name: 'Random' }))

    for (const control of controls) {
      expect(control.className).toMatch(/\b(?:h|size)-8\b/)
      expect(control.className).toContain('rounded-lg')
      expect(control.className).toContain('bg-hover')
      expect(control.className).toContain('text-sm')
    }
  })
})
