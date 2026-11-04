// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GenerationTile } from '@/features/media-picker/picker/GenerationTile'
import { useMediaPickerStore } from '@/features/media-picker/picker/store'
import { MediaTile } from '@/features/media-picker/tiles/MediaTile'

import type { GridItem } from '../src/core/feed/grid-item'
import { upload } from './helpers/validation-fixtures'

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const ITEM: GridItem = {
  id: 'output-1',
  recordId: 'record-1',
  recordKind: 'image',
  status: 'completed',
  createdAt: '2026-01-01T00:00:00.000Z',
  favorite: false,
  width: 1024,
  height: 1024,
  thumbSrc: '/api/thumbs/images/a.png',
  mediaSrc: '/api/media/images/a.png',
  modelTitle: 'Fixture',
  prompt: 'a cat',
  costUsd: 0.01,
  canSelect: true,
}

function describedText(control: HTMLElement): string | null {
  const id = control.getAttribute('aria-describedby')

  if (id === null) {
    return null
  }

  return document.getElementById(id)?.textContent ?? null
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  useMediaPickerStore.setState({ outputUploads: {} })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('disabled tile reason', () => {
  it('points a disabled generation tile at its reason', () => {
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

    const tile = screen.getByRole('button', { name: /Use Fixture generation/ })

    expect(tile.getAttribute('aria-describedby')).not.toBeNull()
    expect(describedText(tile)).toBe('Reference limit reached')
  })

  it('points a disabled upload tile at its reason', () => {
    const item = upload('a', 'image')

    render(
      <MediaTile
        item={item}
        mediaRef="uploads/a"
        disabled
        disabledReason="Audio only"
        onSelect={vi.fn()}
      />,
    )

    const tile = screen.getByRole('button', { name: 'a.png' })

    expect(tile.getAttribute('aria-describedby')).not.toBeNull()
    expect(describedText(tile)).toBe('Audio only')
  })
})
