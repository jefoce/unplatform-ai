// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GenerationTile } from '@/features/media-picker/picker/GenerationTile'
import { pickerTabList } from '@/features/media-picker/picker/picker-tab-list'
import { PickerTabs } from '@/features/media-picker/picker/PickerTabs'
import {
  outputKey,
  type PickerOutputMode,
  type PickerRequest,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'

import type { GridItem } from '../src/core/feed/grid-item'

const ITEM: GridItem = {
  id: 'output-1',
  recordId: 'record-1',
  recordKind: 'image',
  status: 'completed',
  createdAt: '2026-01-01T00:00:00.000Z',
  favorite: true,
  width: 1024,
  height: 1024,
  thumbSrc: '/api/thumbs/images/a.png',
  mediaSrc: '/api/media/images/a.png',
  modelTitle: 'Fixture',
  prompt: 'a cat',
  costUsd: 0.01,
  canSelect: true,
}

function request(generations: PickerRequest['generations']): PickerRequest {
  return {
    id: 1,
    openerKey: 'test',
    kinds: ['image'],
    generations,
    output: {},
    anchor: null,
    mode: { kind: 'pick', onPick: vi.fn() },
  }
}

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  useMediaPickerStore.setState({ outputUploads: {} })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('pickerTabList', () => {
  it('shows the image tabs', () => {
    expect(
      pickerTabList(request('image')).map((tab) => {
        return tab.label
      }),
    ).toEqual(['Uploads', 'Generations', 'Liked'])
  })

  it('shows both generation tabs for the video picker', () => {
    expect(
      pickerTabList(request('both')).map((tab) => {
        return tab.label
      }),
    ).toEqual(['Uploads', 'Image generations', 'Video generations', 'Liked'])
  })

  it('shows uploads only without generation handlers', () => {
    const withoutOutput = { ...request('image'), output: undefined }

    expect(
      pickerTabList(withoutOutput).map((tab) => {
        return tab.label
      }),
    ).toEqual(['Uploads'])
  })
})

describe('PickerTabs', () => {
  it('renders the static tabs and reports a change', () => {
    const handleTabChange = vi.fn()

    render(
      <PickerTabs
        tabs={pickerTabList(request('image'))}
        folders={[]}
        activeTab="uploads"
        onTabChange={handleTabChange}
        onAddFolder={vi.fn()}
        onDisconnectFolder={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const uploads = screen.getByRole('button', { name: 'Uploads' })
    const generations = screen.getByRole('button', { name: 'Generations' })

    expect(uploads.getAttribute('aria-pressed')).toBe('true')
    expect(generations.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(generations)

    expect(handleTabChange).toHaveBeenCalledWith('image-generations')
  })
})

describe('GenerationTile', () => {
  it('toggles an image output with its record and output ids', () => {
    const onToggle = vi.fn<(item: unknown) => void>()
    const output: PickerOutputMode = { onToggle }

    render(<GenerationTile item={ITEM} modeKind="toggle" output={output} />)
    fireEvent.click(screen.getByRole('button', { name: /Use Fixture generation/ }))

    expect(onToggle).toHaveBeenCalledWith({
      recordId: 'record-1',
      outputId: 'output-1',
      recordKind: 'image',
      favorite: true,
    })
  })

  it('picks a video record without an output id', () => {
    const onPick = vi.fn<(item: unknown) => void>()
    const video: GridItem = { ...ITEM, id: 'record-1', recordKind: 'video' }

    render(<GenerationTile item={video} modeKind="pick" output={{ onPick }} />)
    fireEvent.click(screen.getByRole('button', { name: /Use Fixture generation/ }))

    expect(onPick).toHaveBeenCalledWith({
      recordId: 'record-1',
      outputId: null,
      recordKind: 'video',
      favorite: true,
    })
  })

  it('rings a selected generation tile', () => {
    const candidate = {
      recordId: 'record-1',
      outputId: 'output-1',
      recordKind: 'image' as const,
      favorite: true,
    }

    useMediaPickerStore.setState({ outputUploads: { [outputKey(candidate)]: 'upload-1' } })

    render(<GenerationTile item={ITEM} modeKind="toggle" output={{}} />)

    const tile = screen.getByRole('button', { name: /Use Fixture generation/ })

    expect(tile.className).toContain('ring-2')
    expect(tile.getAttribute('aria-pressed')).toBe('true')
  })

  it('disables the tile with the caller canAdd reason', () => {
    render(
      <GenerationTile
        item={ITEM}
        modeKind="toggle"
        output={{
          canAdd: () => {
            return 'Reference limit reached'
          },
        }}
      />,
    )

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Use Fixture generation/ }).disabled,
    ).toBe(true)
  })
})
