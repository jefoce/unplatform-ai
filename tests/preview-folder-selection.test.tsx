// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UploadItem } from '@/core/schemas/upload-item'
import { FolderTab } from '@/features/media-picker/folders/FolderTab'
import type { PickerMode } from '@/features/media-picker/picker/store'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

import { upload } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchFolderFiles: vi.fn(),
    linkFolderFile: vi.fn(),
  }
})

vi.mock('@/lib/api/folders', () => {
  return {
    fetchFolderFiles: mocks.fetchFolderFiles,
  }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/media-urls', () => {
  return {
    mediaUrl: () => {
      return '/media'
    },
    thumbUrl: () => {
      return '/thumb'
    },
  }
})

vi.mock('swr', () => {
  return {
    default: () => {
      return {
        data: {
          path: '',
          dirs: [],
          files: [
            { name: 'clip.mp4', rel: 'clip.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 },
            { name: 'second.mp4', rel: 'second.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 },
          ],
        },
        isLoading: false,
      }
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => {
      return Promise.resolve()
    },
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  closePreview()
  vi.unstubAllGlobals()
  mocks.fetchFolderFiles.mockReset()
  mocks.linkFolderFile.mockReset()
})

function toggleMode(onToggle: (item: UploadItem) => void): PickerMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return []
    },
    useUploadsById: () => {
      return {}
    },
    canAdd: () => {
      return null
    },
    onToggle,
    onAdd: vi.fn(),
  }
}

function renderPreview(mode: PickerMode) {
  return render(
    <>
      <FolderTab
        folderId="folder-1"
        folderPath="/videos/root"
        folderName="Folder"
        kinds={['video']}
        sub=""
        mode={mode}
        onNavigate={vi.fn<(sub: string) => void>()}
      />
      <MediaPreviewModal />
    </>,
  )
}

describe('FolderTab preview selection', () => {
  it('links from the preview and keeps the dialog open in toggle mode', async () => {
    const linked = upload('linked', 'video')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onToggle = vi.fn<(item: UploadItem) => void>()

    renderPreview(toggleMode(onToggle))

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(linked)
    })

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('links, picks and closes the preview in pick mode', async () => {
    const linked = upload('linked', 'video')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onPick = vi.fn<(item: UploadItem) => void>()

    renderPreview({ kind: 'pick', onPick })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledWith(linked)
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

describe('FolderTab preview items', () => {
  it('opens the preview without linking and hides the Use button', () => {
    renderPreview(toggleMode(vi.fn<(item: UploadItem) => void>()))

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    expect(mocks.linkFolderFile).not.toHaveBeenCalled()

    const request = usePreviewStore.getState().request
    const item = request?.items[0]

    if (isNil(request) || isNil(item)) {
      throw new Error('preview request missing')
    }

    expect(item.id).toBe('folder:folder-1:clip.mp4')
    expect(item.previewRef).toBe('folders/folder-1/clip.mp4')
    expect(item.mime).toBe('video/mp4')
    expect(request.allowUse).toBe(false)
  })

  it('chains every filtered file and opens at the clicked index', () => {
    renderPreview(toggleMode(vi.fn<(item: UploadItem) => void>()))

    fireEvent.click(screen.getByRole('button', { name: 'Preview second.mp4' }))

    const request = usePreviewStore.getState().request

    if (isNil(request)) {
      throw new Error('preview request missing')
    }

    expect(
      request.items.map((item) => {
        return item.id
      }),
    ).toEqual(['folder:folder-1:clip.mp4', 'folder:folder-1:second.mp4'])

    expect(request.index).toBe(1)
  })
})
