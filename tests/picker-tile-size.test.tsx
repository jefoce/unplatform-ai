// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GenerationGrid } from '@/features/media-picker/picker/GenerationGrid'
import { GenerationTile } from '@/features/media-picker/picker/GenerationTile'
import { MediaTile } from '@/features/media-picker/tiles/MediaTile'
import {
  PICKER_GRID_CLASSES,
  PICKER_TILE_CLASSES,
  PICKER_TILE_PX,
  pickerColumns,
} from '@/features/media-picker/tiles/tile-classes'
import { UploadsGrid } from '@/features/media-picker/uploads/UploadsGrid'

import type { GridItem } from '../src/core/feed/grid-item'
import { upload } from './helpers/validation-fixtures'

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

const NO_REASON: string | undefined = undefined

/** No disabled reason for the rendered upload tile. */
function noReason(): string | undefined {
  return NO_REASON
}

function gridOf(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>('div.grid')

  if (grid === null) {
    throw new Error('Missing picker grid')
  }

  return grid
}

afterEach(cleanup)

describe('picker columns', () => {
  it('keeps the video panel at four columns of one card size', () => {
    expect(PICKER_TILE_PX).toBe(120.5)
    expect(pickerColumns(518)).toBe(4)
  })

  it('fits more columns in the wider image panel', () => {
    expect(pickerColumns(838)).toBe(6)
  })

  it('never returns fewer than one column', () => {
    expect(pickerColumns(0)).toBe(1)
  })
})

describe('picker tile sizes', () => {
  it('uses one tile class for uploads and generation outputs', () => {
    const item = upload('a', 'image')

    render(<MediaTile item={item} mediaRef="uploads/a" onSelect={vi.fn()} />)

    const uploadTile = screen.getByRole('button', { name: 'a.png' }).parentElement

    expect(uploadTile?.className).toBe(PICKER_TILE_CLASSES)

    cleanup()

    render(
      <GenerationTile
        item={ITEM}
        modeKind="toggle"
        output={{
          canAdd: () => {
            return null
          },
        }}
      />,
    )

    expect(screen.getByRole('button', { name: /Use Fixture generation/ }).className).toBe(
      PICKER_TILE_CLASSES,
    )
  })

  it('uses one grid class for uploads and generation tabs', () => {
    const generation = render(
      <GenerationGrid
        items={[ITEM]}
        isLoading={false}
        modeKind="toggle"
        output={{
          canAdd: () => {
            return null
          },
        }}
        emptyLabel="None"
      />,
    )

    expect(gridOf(generation.container).className).toBe(PICKER_GRID_CLASSES)

    const uploads = render(
      <UploadsGrid
        items={[]}
        uploading={[]}
        isLoading={false}
        canChooseFiles={false}
        kinds={['image']}
        max={1}
        actions={{}}
        isSelected={() => {
          return false
        }}
        disabledReason={noReason}
        onUploaded={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(gridOf(uploads.container).className).toBe(PICKER_GRID_CLASSES)
  })
})
