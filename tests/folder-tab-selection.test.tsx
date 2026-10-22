// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FolderTab } from '@/features/media-picker/FolderTab'
import { closePreview, usePreviewStore } from '@/features/preview/preview-store'

const mocks = vi.hoisted(() => ({
  fetchFolderFiles: vi.fn(),
  linkFolderFile: vi.fn(),
}))

vi.mock('@/features/media-picker/api', () => ({
  fetchFolderFiles: mocks.fetchFolderFiles,
  linkFolderFile: mocks.linkFolderFile,
  thumbUrl: () => '/thumb',
}))

vi.mock('swr', () => ({
  default: () => ({
    data: {
      path: '',
      dirs: [],
      files: [{ name: 'clip.mp4', rel: 'clip.mp4', kind: 'video', sizeBytes: 1, mtimeMs: 1 }],
    },
    isLoading: false,
  }),
}))

afterEach(() => {
  cleanup()
  closePreview()
  mocks.fetchFolderFiles.mockReset()
  mocks.linkFolderFile.mockReset()
})

interface RenderTabParams {
  max: number
  onPickFile: (rel: string) => void
  selectedRels?: string[]
}

interface RenderTabResult {
  onNavigate: ReturnType<typeof vi.fn>
  onToggleFile: ReturnType<typeof vi.fn>
}

function renderTab(params: RenderTabParams): RenderTabResult {
  const { max, selectedRels = [] } = params
  const handlePickFile = params.onPickFile
  const handleNavigate = vi.fn()
  const handleToggleFile = vi.fn()

  render(
    <FolderTab
      folderId="folder-1"
      folderName="Folder"
      kinds={['video']}
      max={max}
      sub=""
      selectedRels={selectedRels}
      onPickFile={handlePickFile}
      onNavigate={handleNavigate}
      onToggleFile={handleToggleFile}
    />,
  )

  return { onNavigate: handleNavigate, onToggleFile: handleToggleFile }
}

describe('FolderTab selection', () => {
  it('rings the file through the parent without linking when multiple files are allowed', () => {
    const onPickFile = vi.fn<(rel: string) => void>()
    const { onToggleFile } = renderTab({ max: 3, onPickFile })

    fireEvent.click(screen.getByRole('button', { name: 'Select clip.mp4' }))

    expect(mocks.linkFolderFile).not.toHaveBeenCalled()
    expect(onPickFile).not.toHaveBeenCalled()
    expect(onToggleFile).toHaveBeenCalledWith('clip.mp4')
  })

  it('leaves the ring to the controlled prop', () => {
    const { onToggleFile } = renderTab({
      max: 3,
      onPickFile: vi.fn<(rel: string) => void>(),
      selectedRels: ['clip.mp4'],
    })
    const tile = screen.getByRole('button', { name: 'Select clip.mp4' })

    fireEvent.click(tile)
    fireEvent.click(tile)

    expect(onToggleFile).toHaveBeenCalledTimes(2)
    expect(onToggleFile).toHaveBeenNthCalledWith(1, 'clip.mp4')
    expect(onToggleFile).toHaveBeenNthCalledWith(2, 'clip.mp4')
  })

  it('opens the folder preview without linking', () => {
    renderTab({ max: 3, onPickFile: vi.fn<(rel: string) => void>() })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    expect(mocks.linkFolderFile).not.toHaveBeenCalled()

    const request = usePreviewStore.getState().request
    const item = request?.items[0]

    if (isNil(request) || isNil(item)) throw new Error('preview request missing')

    expect(item.id).toBe('folder:folder-1:clip.mp4')
    expect(item.previewRef).toBe('folders/folder-1/clip.mp4')
    expect(item.mime).toBe('video/mp4')
  })

  it('selects from the preview without linking when multiple files are allowed', () => {
    const onPickFile = vi.fn<(rel: string) => void>()
    const { onToggleFile } = renderTab({ max: 3, onPickFile })

    fireEvent.click(screen.getByRole('button', { name: 'Preview clip.mp4' }))

    const request = usePreviewStore.getState().request
    const item = request?.items[0]

    if (isNil(request) || isNil(item)) throw new Error('preview request missing')

    act(() => request.actions?.select?.(item))

    expect(mocks.linkFolderFile).not.toHaveBeenCalled()
    expect(onPickFile).not.toHaveBeenCalled()
    expect(onToggleFile).toHaveBeenCalledWith('clip.mp4')
  })

  it('picks the file immediately when only one is allowed', () => {
    const onPickFile = vi.fn<(rel: string) => void>()
    const { onToggleFile } = renderTab({ max: 1, onPickFile })

    fireEvent.click(screen.getByRole('button', { name: 'Select clip.mp4' }))

    expect(onPickFile).toHaveBeenCalledWith('clip.mp4')
    expect(onToggleFile).not.toHaveBeenCalled()
  })
})
