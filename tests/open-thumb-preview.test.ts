// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { openThumb, type ThumbItem } from '@/features/history/details/thumb-item'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchUploads: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock('@/lib/api/uploads', () => {
  return { fetchUploads: mocks.fetchUploads }
})

vi.mock('sonner', () => {
  return { toast: { error: mocks.toastError, success: vi.fn() } }
})

function thumb(id: string): ThumbItem {
  return { id, label: 'Reference', name: id, missing: false }
}

afterEach(() => {
  cleanup()
  closePreview()
  mocks.fetchUploads.mockReset()
  mocks.toastError.mockReset()
})

describe('openThumb preview chain', () => {
  it('drops a missing upload and opens at the clicked item', async () => {
    const first = thumb('a')
    const second = thumb('b')
    const third = thumb('c')
    const items = [first, second, third]

    mocks.fetchUploads.mockResolvedValue([upload('b', 'image'), upload('c', 'image')])

    await openThumb({ item: second, items, index: 1 })

    expect(mocks.fetchUploads).toHaveBeenCalledWith({ ids: ['a', 'b', 'c'] })
    expect(mocks.toastError).not.toHaveBeenCalled()

    const request = usePreviewStore.getState().request

    if (!request) {
      throw new Error('preview request missing')
    }

    expect(
      request.items.map((item) => {
        return item.id
      }),
    ).toEqual(['b', 'c'])

    expect(request.index).toBe(0)
  })

  it('toasts without opening when the clicked upload is gone', async () => {
    const first = thumb('a')
    const second = thumb('b')
    const third = thumb('c')
    const items = [first, second, third]

    mocks.fetchUploads.mockResolvedValue([upload('a', 'image'), upload('b', 'image')])

    await openThumb({ item: third, items, index: 2 })

    expect(mocks.toastError).toHaveBeenCalledWith('File no longer exists')
    expect(usePreviewStore.getState().request).toBeNull()
  })
})
