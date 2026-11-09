// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { parseAspect } from '@/core/media/geometry'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { DetailsSettings } from '@/features/history/details/DetailsSettings'
import { RatioIcon } from '@/ui/RatioIcon'

import { imageItem } from './helpers/image-details-fixture'

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    fetcher: vi.fn(),
    ApiError: class ApiError extends Error {
      status = 0
    },
  }
})

vi.mock('@/lib/platform', () => {
  return {
    platform: { confirm: vi.fn(), saveVideo: vi.fn(), saveVideos: vi.fn() },
  }
})

vi.mock('sonner', () => {
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

class Observer {
  observe() {}
  disconnect() {}
}

function record(aspectRatio: GenerationRecord['input']['aspectRatio']): GenerationRecord {
  return {
    id: 'ratio',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    provider: 'openrouter',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: 'Prompt',
      audio: true,
      duration: 4,
      aspectRatio,
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    output: { video: 'ratio.mp4', preview: 'ratio.preview.png' },
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function ratioBox(chip: HTMLElement): HTMLElement {
  const box = chip.querySelector('.border')

  expect(box).not.toBeNull()

  return box as HTMLElement
}

describe('video details chips', () => {
  it('draws the resolution chip with Monitor and the aspect chip at the real ratio', () => {
    render(<DetailsSettings record={record('16:9')} />)

    const resolution = screen.getByText('1080p')
    const aspect = screen.getByText('16:9')

    expect(resolution.querySelector('svg.lucide-monitor')).not.toBeNull()
    expect(ratioBox(aspect).className).toContain('border')
  })
})

describe('RatioIcon', () => {
  it.each(['1:1', '16:9', '9:16', '21:9'])(
    'draws %s at its parsed ratio inside the 14px box',
    (ratio) => {
      const { container } = render(<RatioIcon ratio={ratio} />)
      const square = container.firstElementChild as HTMLElement
      const box = square.firstElementChild as HTMLElement
      const sides = parseAspect(ratio)

      expect(sides).not.toBeNull()

      const [width, height] = sides as [number, number]
      const drawn = Number.parseFloat(box.style.width) / Number.parseFloat(box.style.height)

      expect(Math.abs(drawn - width / height)).toBeLessThanOrEqual(0.02)
      expect(Number.parseFloat(box.style.width)).toBeLessThanOrEqual(14)
      expect(Number.parseFloat(box.style.height)).toBeLessThanOrEqual(14)
    },
  )
})

describe('image details chips', () => {
  it('uses Monitor for the resolution and a ratio box for the aspect', () => {
    render(
      <DetailsPanel
        item={imageItem({
          presetId: 'gemini-3.1-flash-image',
          title: 'Nano Banana 2',
          resolution: '1K',
        })}
      />,
    )

    const resolution = screen.getByText('1K')

    expect(resolution.querySelector('svg.lucide-monitor')).not.toBeNull()
    expect(ratioBox(screen.getByText('1:1')).className).toContain('border')
  })

  it('uses Sparkles for quality and Layers2 for background', () => {
    render(<DetailsPanel item={imageItem()} />)

    expect(screen.getByText('Extra High').querySelector('svg.lucide-sparkles')).not.toBeNull()
    expect(screen.getByText('Transparent').querySelector('svg.lucide-layers-2')).not.toBeNull()
  })
})
