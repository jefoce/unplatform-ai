// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AspectRatio } from '@/core/presets/types'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { AspectRatioPopover } from '@/features/generator/options/AspectRatioPopover'
import { useGeneratorStore } from '@/features/generator/store/store'
import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { RatioIcon } from '@/ui/RatioIcon'

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

  useGeneratorStore.setState({
    presetId: 'wan-3.0',
    tab: 'frames',
    prompts: { frames: '', references: '' },
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    uploadsById: {},
    seed: null,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function boxFor(ratio: AspectRatio) {
  const { container } = render(<RatioIcon ratio={ratio} />)
  const square = container.firstElementChild as HTMLElement
  const box = square.firstElementChild as HTMLElement

  return { square, box }
}

describe('RatioIcon', () => {
  it.each(['16:9', '9:16'] satisfies AspectRatio[])('draws %s as an outlined box', (ratio) => {
    const { square, box } = boxFor(ratio)
    const width = Number(ratio.split(':')[0])
    const height = Number(ratio.split(':')[1])

    expect(box.className).toContain('border')

    expect(Number.parseFloat(box.style.width) / Number.parseFloat(box.style.height)).toBeCloseTo(
      width / height,
    )

    expect(square.style.width).toBe('14px')
    expect(square.style.height).toBe('14px')
    expect(square.className).toContain('items-center')
    expect(square.className).toContain('justify-center')
    expect(Number.parseFloat(box.style.width)).toBeLessThanOrEqual(14)
    expect(Number.parseFloat(box.style.height)).toBeLessThanOrEqual(14)
    expect(square.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders the lucide icon for auto', () => {
    const { container } = render(<RatioIcon ratio="auto" />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('14')
    expect(svg?.getAttribute('height')).toBe('14')
  })

  it('honors size', () => {
    const { container } = render(<RatioIcon ratio="auto" size={16} />)

    expect(container.querySelector('svg')?.getAttribute('width')).toBe('16')
  })
})

function expectRatioBox(root: HTMLElement, ratio: AspectRatio) {
  const square = root.firstElementChild as HTMLElement
  const box = square.firstElementChild as HTMLElement
  const width = Number(ratio.split(':')[0])
  const height = Number(ratio.split(':')[1])

  expect(square.getAttribute('aria-hidden')).toBe('true')
  expect(box.className).toContain('border')

  expect(Number.parseFloat(box.style.width) / Number.parseFloat(box.style.height)).toBeCloseTo(
    width / height,
  )
}

describe('field and history callers', () => {
  it('draws the field icon at the selected ratio', () => {
    useGeneratorStore.setState({ aspectRatio: '9:16' })
    render(<AspectRatioPopover />)

    expectRatioBox(screen.getByRole('button', { name: '9:16' }), '9:16')
  })

  it('draws the lucide Ratio icon for an auto field', () => {
    useGeneratorStore.setState({
      aspectRatio: 'auto',
      tab: 'frames',
      frames: { start: 'start-frame', end: null },
    })

    render(<AspectRatioPopover />)

    const svg = screen.getByRole('button', { name: 'Auto' }).querySelector('svg')

    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
  })

  it('draws the history chip icon at the record ratio', () => {
    render(<DetailsPanel record={record('9:16')} />)

    expectRatioBox(screen.getByText('9:16'), '9:16')
  })
})
