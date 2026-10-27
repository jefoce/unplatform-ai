// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import {
  closePreview,
  openPreview,
  type PreviewItem,
  usePreviewStore,
} from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

const items: PreviewItem[] = [upload('first', 'image'), upload('second', 'image')]

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closePreview()
  vi.unstubAllGlobals()
})

function renderModal(): void {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
  render(<MediaPreviewModal />)
}

describe('MediaPreviewModal close button', () => {
  it('closes the viewer from the top-right button', async () => {
    renderModal()

    act(() => {
      openPreview({ items, index: 0 })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(usePreviewStore.getState().request).toBeNull()
    })
  })
})

describe('MediaPreviewModal action close rule', () => {
  it('stays open when select returns true and runs the action', () => {
    const handleSelect = vi.fn<(item: UploadItem) => boolean>()

    handleSelect.mockReturnValue(true)

    renderModal()

    act(() => {
      openPreview({ items, index: 0, actions: { select: handleSelect } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes when select returns nothing', async () => {
    const handleSelect = vi.fn<(item: UploadItem) => void>()

    renderModal()

    act(() => {
      openPreview({ items, index: 0, actions: { select: handleSelect } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(handleSelect).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
