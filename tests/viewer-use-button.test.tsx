// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { useGeneratorStore } from '@/features/generator/store/store'
import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { HistoryModal } from '@/features/history/list/HistoryModal'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import {
  closePreview,
  openPreview,
  type PreviewItem,
  usePreviewStore,
} from '@/features/preview/preview-store'
import { ViewerUseButton } from '@/features/viewers/ViewerUseButton'

import { Observer, record, releaseAllSlots } from './helpers/history'
import { required } from './helpers/required'
import { upload } from './helpers/validation-fixtures'

interface UploadsModule {
  linkGenerationFile: (params: { generationId: string }) => Promise<UploadItem>
  linkFolderFile: (params: { folderId: string; relPath: string }) => Promise<UploadItem>
}

interface GenerationsModule {
  captureGenerationFrame: (id: string, at: 'first' | 'last') => Promise<UploadItem>
}

const mocks = vi.hoisted(() => {
  return {
    linkGenerationFile: vi.fn(),
    linkFolderFile: vi.fn(),
    captureGenerationFrame: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock('@/lib/fetcher', () => {
  return {
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    apiPatch: vi.fn(),
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
  return { toast: { success: mocks.toastSuccess, error: mocks.toastError } }
})

vi.mock('@/lib/api/uploads', async (importOriginal) => {
  const actual = await importOriginal<UploadsModule>()

  return {
    ...actual,
    linkGenerationFile: mocks.linkGenerationFile,
    linkFolderFile: mocks.linkFolderFile,
  }
})

vi.mock('@/lib/api/generations', async (importOriginal) => {
  const actual = await importOriginal<GenerationsModule>()

  return { ...actual, captureGenerationFrame: mocks.captureGenerationFrame }
})

const selectedRecord = record('history-record')
const image = upload('upload-image', 'image')

function renderHistoryToolbar(item: GenerationRecord): ReactNode {
  return <ViewerUseButton target={{ kind: 'record', record: item }} />
}

function renderPreviewToolbar(item: PreviewItem): ReactNode {
  return <ViewerUseButton target={{ kind: 'upload', upload: item }} />
}

function historyModal() {
  return (
    <HistoryModal
      record={selectedRecord}
      viewOrder={[selectedRecord.id]}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={vi.fn()}
      toolbar={renderHistoryToolbar}
    />
  )
}

function previewModal() {
  return <MediaPreviewModal toolbar={renderPreviewToolbar} />
}

function resetGenerator(): void {
  useGeneratorStore.setState({
    tab: 'references',
    presetId: 'seedance-2.5',
    references: [],
    frames: { start: null, end: null },
    uploadsById: {},
  })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => {
      return Promise.resolve()
    },
  })

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  mocks.linkGenerationFile.mockReset()
  mocks.linkFolderFile.mockReset()
  mocks.captureGenerationFrame.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  resetGenerator()
  useHistoryViewerStore.getState().close()
  closePreview()
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  useHistoryViewerStore.getState().close()
  closePreview()
  releaseAllSlots()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ViewerUseButton in the viewers', () => {
  it('adds a history record as a reference and closes the viewer', async () => {
    const linked = upload('linked-record', 'video')

    mocks.linkGenerationFile.mockResolvedValue(linked)
    useHistoryViewerStore.getState().open(selectedRecord.id)
    render(historyModal())

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(useGeneratorStore.getState().references).toEqual([linked.id])
    })

    expect(mocks.linkGenerationFile).toHaveBeenCalledWith({ generationId: selectedRecord.id })
    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('adds an upload from the preview and closes the preview', async () => {
    act(() => {
      openPreview({ items: [image], index: 0 })
    })

    render(previewModal())

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(useGeneratorStore.getState().references).toEqual([image.id])
    })

    expect(usePreviewStore.getState().request).toBeNull()
  })

  it('closes the preview and the history viewer when both are open', async () => {
    useHistoryViewerStore.getState().open(selectedRecord.id)

    render(
      <>
        {historyModal()}
        {previewModal()}
      </>,
    )

    act(() => {
      openPreview({ items: [image], index: 0 })
    })

    const buttons = screen.getAllByRole('button', { name: 'Reference' })

    fireEvent.click(required(buttons.at(-1), 'preview use button'))

    await waitFor(() => {
      expect(usePreviewStore.getState().request).toBeNull()
    })

    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })

  it('shows no button when the preview opts out', () => {
    act(() => {
      openPreview({ items: [image], index: 0, allowUse: false })
    })

    render(previewModal())

    expect(screen.queryByRole('button', { name: 'Reference' })).toBeNull()
  })

  it('keeps both viewers open when linking a folder file fails', async () => {
    useHistoryViewerStore.getState().open(selectedRecord.id)

    const folderItem: PreviewItem = {
      ...upload('folder:1:clip.png', 'image'),
      previewRef: 'folders/1/clip.png',
    }

    render(
      <>
        {historyModal()}
        {previewModal()}
      </>,
    )

    act(() => {
      openPreview({ items: [folderItem], index: 0 })
    })

    mocks.linkFolderFile.mockRejectedValue(new Error('link failed'))

    const buttons = screen.getAllByRole('button', { name: 'Reference' })

    fireEvent.click(required(buttons.at(-1), 'preview use button'))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled()
    })

    expect(mocks.linkFolderFile).toHaveBeenCalledWith({ folderId: '1', relPath: 'clip.png' })
    expect(usePreviewStore.getState().request).not.toBeNull()
    expect(useHistoryViewerStore.getState().selectedId).toBe(selectedRecord.id)
  })

  it('shows no Reference button in the list-view details panel', () => {
    render(<DetailsPanel record={selectedRecord} />)

    expect(screen.queryByRole('button', { name: 'Reference' })).toBeNull()
  })
})
