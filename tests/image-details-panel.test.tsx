// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { type HistoryItem, videoItem } from '../src/lib/feed/output-items'
import { record } from './helpers/history'
import { imageItem, savedOutput } from './helpers/image-details-fixture'

interface PanelCase {
  kind: 'video' | 'image'
  title: string
  makeItem: () => HistoryItem
  labels: string[]
  makeUnsupportedItem: () => HistoryItem
  unsupportedLabels: string[]
  hiddenLabels: string[]
  seed: number | null
}

const CASES: PanelCase[] = [
  {
    kind: 'video',
    title: 'Seedance',
    makeItem: () => {
      return videoItem(record('video-details'))
    },
    labels: ['1080p', '4s', '16:9', 'Audio on'],
    makeUnsupportedItem: () => {
      return videoItem(record('video-details'))
    },
    unsupportedLabels: ['1080p'],
    hiddenLabels: [],
    seed: null,
  },
  {
    kind: 'image',
    title: 'GPT Image 2.5 Sunburst',
    makeItem: () => {
      return imageItem({ output: savedOutput(42) })
    },
    labels: ['Extra High', 'Transparent'],
    makeUnsupportedItem: () => {
      return imageItem({
        presetId: 'gemini-3.1-flash-image',
        title: 'Nano Banana 2',
        resolution: '1K',
        quality: 'high',
        background: 'opaque',
      })
    },
    unsupportedLabels: ['1K'],
    hiddenLabels: ['High', 'Opaque', 'Default'],
    seed: 42,
  },
]

afterEach(() => {
  cleanup()
})

describe.each(CASES)('$kind shared details panel', (testCase) => {
  it('keeps the model chip clear of the viewer close button when inset', () => {
    render(<DetailsPanel item={testCase.makeItem()} topRightInset />)

    const header = screen.getByText(testCase.title).parentElement

    expect(header?.className).toContain('pr-10')
  })

  it('uses the preset labels for every supported setting', () => {
    render(<DetailsPanel item={testCase.makeItem()} />)

    for (const label of testCase.labels) {
      expect(screen.getByText(label)).not.toBeNull()
    }
  })

  it('hides settings the preset does not support', () => {
    render(<DetailsPanel item={testCase.makeUnsupportedItem()} />)

    for (const label of testCase.unsupportedLabels) {
      expect(screen.getByText(label)).not.toBeNull()
    }

    for (const label of testCase.hiddenLabels) {
      expect(screen.queryByText(label)).toBeNull()
    }
  })

  it('marks an unreported cost as an estimate', () => {
    if (testCase.kind !== 'image') {
      return
    }

    render(<DetailsPanel item={imageItem({ actualUsd: null })} />)

    expect(screen.getByText('≈ $0.20')).not.toBeNull()
  })

  it('shows the actual cost when it is reported', () => {
    if (testCase.kind !== 'image') {
      return
    }

    render(<DetailsPanel item={imageItem({ actualUsd: 0.2 })} />)

    expect(screen.getByText('$0.20')).not.toBeNull()
    expect(screen.queryByText('≈ $0.20')).toBeNull()
  })

  it('renders the per-kind image actions', () => {
    if (testCase.kind !== 'image') {
      return
    }

    render(<DetailsPanel item={testCase.makeItem()} />)

    expect(screen.getByRole('button', { name: 'Reuse' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Like' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Reference' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'More actions' })).not.toBeNull()
  })

  it('shows the output seed only for saved image outputs', () => {
    render(<DetailsPanel item={testCase.makeItem()} />)

    if (testCase.seed === null) {
      expect(screen.queryByText(/^Seed /)).toBeNull()
      expect(screen.queryByRole('button', { name: 'Use seed' })).toBeNull()

      return
    }

    expect(screen.getByText(`Seed ${testCase.seed}`)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Use seed' })).not.toBeNull()
  })
})

describe('image references', () => {
  it('renders one thumb for each reference', () => {
    const { container } = render(
      <DetailsPanel item={imageItem({ references: ['reference-one', 'reference-two'] })} />,
    )

    expect(container.querySelectorAll('img[src^="/api/thumbs/uploads/"]')).toHaveLength(2)
  })
})

describe('use image seed', () => {
  it('switches to the record preset and takes its seed', () => {
    useImageGeneratorStore.setState({ presetId: 'gemini-2.5-flash-image', seed: null })

    render(
      <DetailsPanel
        item={imageItem({ presetId: 'seedream-5-0-flash', output: savedOutput(42) })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use seed' }))

    const state = useImageGeneratorStore.getState()

    expect(state.presetId).toBe('seedream-5-0-flash')
    expect(state.seed).toBe(42)
  })

  it('clears the seed when the record preset has no seed control', () => {
    useImageGeneratorStore.setState({ presetId: 'seedream-5-0-flash', seed: 7 })

    render(<DetailsPanel item={imageItem({ output: savedOutput(42) })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use seed' }))

    const state = useImageGeneratorStore.getState()

    expect(state.presetId).toBe('gpt-image-2.5-sunburst')
    expect(state.seed).toBeNull()
  })
})
