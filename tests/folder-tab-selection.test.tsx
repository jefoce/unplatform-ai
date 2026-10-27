// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { folderTargetPath } from '@/core/folder-match'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import { FolderTab } from '@/features/media-picker/folders/FolderTab'
import type { PickerMode } from '@/features/media-picker/picker/store'

import { upload, uploadsOf } from './helpers/validation-fixtures'

const mocks = vi.hoisted(() => {
  return {
    fetchFolderFiles: vi.fn(),
    linkFolderFile: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock('@/lib/api/folders', () => {
  return {
    fetchFolderFiles: mocks.fetchFolderFiles,
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/uploads', () => {
  return {
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/media-urls', () => {
  return {
    thumbUrl: () => {
      return '/thumb'
    },
  }
})

vi.mock('@/lib/notify', () => {
  return {
    toastError: mocks.toastError,
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

const FOLDER_PATH = '/videos/root'

afterEach(() => {
  cleanup()
  mocks.fetchFolderFiles.mockReset()
  mocks.linkFolderFile.mockReset()
  mocks.toastError.mockReset()
})

interface RenderTabParams {
  mode: PickerMode
}

function renderTab(params: RenderTabParams) {
  const handleNavigate = vi.fn()

  render(
    <FolderTab
      folderId="folder-1"
      folderPath={FOLDER_PATH}
      folderName="Folder"
      kinds={['video']}
      sub=""
      mode={params.mode}
      onNavigate={handleNavigate}
    />,
  )

  return { onNavigate: handleNavigate }
}

interface ToggleHarnessProps {
  onToggle: (item: UploadItem) => void
}

/** Toggle mode backed by real state so the tile can show its attachment. */
function ToggleHarness(props: ToggleHarnessProps) {
  const [selected, setSelected] = useState<UploadItem[]>([])

  const handleToggle = (item: UploadItem) => {
    props.onToggle(item)

    setSelected((previous) => {
      const isAttached = previous.some((each) => {
        return each.id === item.id
      })

      if (isAttached) {
        return previous.filter((each) => {
          return each.id !== item.id
        })
      }

      return [...previous, item]
    })
  }

  const uploadsById: UploadsById = uploadsOf(...selected)

  const mode: PickerMode = {
    kind: 'toggle',
    useSelectedIds: () => {
      return selected.map((item) => {
        return item.id
      })
    },
    useUploadsById: () => {
      return uploadsById
    },
    canAdd: () => {
      return null
    },
    onToggle: handleToggle,
    onAdd: vi.fn(),
  }

  return (
    <FolderTab
      folderId="folder-1"
      folderPath={FOLDER_PATH}
      folderName="Folder"
      kinds={['video']}
      sub=""
      mode={mode}
      onNavigate={vi.fn()}
    />
  )
}

function folderUpload(id: string, rel: string): UploadItem {
  return upload(id, 'video', {
    source: 'link',
    target: folderTargetPath({ folderPath: FOLDER_PATH, rel }),
  })
}

function selectButton(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Select ${name}` })
}

describe('FolderTab selection', () => {
  it('links the file once, toggles it and shows it selected', async () => {
    const linked = folderUpload('linked', 'clip.mp4')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onToggle = vi.fn<(item: UploadItem) => void>()

    render(<ToggleHarness onToggle={onToggle} />)

    fireEvent.click(selectButton('clip.mp4'))

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith(linked)
    })

    expect(mocks.linkFolderFile).toHaveBeenCalledWith({
      folderId: 'folder-1',
      relPath: 'clip.mp4',
    })

    await waitFor(() => {
      expect(selectButton('clip.mp4').getAttribute('aria-pressed')).toBe('true')
    })
  })

  it('toggles the already linked upload without linking again', async () => {
    const linked = folderUpload('linked', 'clip.mp4')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onToggle = vi.fn<(item: UploadItem) => void>()

    render(<ToggleHarness onToggle={onToggle} />)

    fireEvent.click(selectButton('clip.mp4'))

    await waitFor(() => {
      expect(selectButton('clip.mp4').getAttribute('aria-pressed')).toBe('true')
    })

    fireEvent.click(selectButton('clip.mp4'))

    expect(onToggle).toHaveBeenCalledTimes(2)
    expect(onToggle).toHaveBeenLastCalledWith(linked)
    expect(mocks.linkFolderFile).toHaveBeenCalledTimes(1)
  })

  it('toasts a failed link and keeps the tile unselected', async () => {
    mocks.linkFolderFile.mockRejectedValue(new Error('link failed'))

    const onToggle = vi.fn<(item: UploadItem) => void>()

    render(<ToggleHarness onToggle={onToggle} />)

    fireEvent.click(selectButton('clip.mp4'))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled()
    })

    expect(selectButton('clip.mp4').getAttribute('aria-pressed')).toBe('false')
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('links and picks the file in pick mode', async () => {
    const linked = folderUpload('linked', 'clip.mp4')

    mocks.linkFolderFile.mockResolvedValue(linked)

    const onPick = vi.fn<(item: UploadItem) => void>()

    renderTab({ mode: { kind: 'pick', onPick } })

    fireEvent.click(selectButton('clip.mp4'))

    await waitFor(() => {
      expect(onPick).toHaveBeenCalledWith(linked)
    })

    expect(mocks.linkFolderFile).toHaveBeenCalledWith({
      folderId: 'folder-1',
      relPath: 'clip.mp4',
    })
  })
})
