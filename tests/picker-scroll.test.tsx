// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FolderFile } from '@/core/media-types'
import { FolderGrid } from '@/features/media-picker/folders/FolderGrid'
import type { PickerMode } from '@/features/media-picker/picker/store'

vi.mock('@/lib/api/media-urls', () => {
  return {
    thumbUrl: () => {
      return '/thumb'
    },
  }
})

const PICK_MODE: PickerMode = { kind: 'pick', onPick: vi.fn() }

function file(name: string): FolderFile {
  return { name, rel: name, kind: 'video', sizeBytes: 1, mtimeMs: 1 }
}

const FILES = [file('one.mp4'), file('two.mp4'), file('three.mp4')]

function folderGrid(files: FolderFile[], isLoading: boolean) {
  return (
    <FolderGrid
      folderId="folder-1"
      folderPath="/videos/root"
      dirs={[]}
      files={files}
      mode={PICK_MODE}
      selectedIds={[]}
      uploadsById={{}}
      linkingRel={null}
      broken={[]}
      isLoading={isLoading}
      onNavigate={vi.fn()}
      onSelect={vi.fn()}
      onExpand={vi.fn()}
      onBroken={vi.fn()}
    />
  )
}

function selectButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /^Select / })
}

function firstSelectButton(): HTMLElement {
  const button = selectButtons()[0]

  if (isNil(button)) {
    throw new Error('Missing tile select button')
  }

  return button
}

afterEach(cleanup)

describe('picker scroll', () => {
  it('keeps every tile and shows no skeleton when files are already loaded', () => {
    render(folderGrid(FILES, true))

    expect(selectButtons()).toHaveLength(FILES.length)
    expect(document.querySelector('.animate-pulse')).toBeNull()
  })

  it('keeps the first tile node across rerenders with the same rel keys', () => {
    const { rerender } = render(folderGrid(FILES, false))
    const firstTile = firstSelectButton().parentElement

    rerender(
      folderGrid(
        FILES.map((each) => {
          return { ...each }
        }),
        false,
      ),
    )

    expect(firstSelectButton().parentElement).toBe(firstTile)
    expect(firstTile?.contains(firstSelectButton())).toBe(true)
  })

  it('shows skeletons before the first load finishes', () => {
    const { container } = render(folderGrid([], true))

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('contains scroll and reserves the scrollbar gutter', () => {
    const { container } = render(folderGrid([], false))
    const scroller = container.firstElementChild

    expect(scroller?.classList.contains('overscroll-contain')).toBe(true)
    expect(scroller?.classList.contains('scrollbar-gutter-stable')).toBe(true)
  })
})
