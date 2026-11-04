// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import { ReferenceButton } from '@/features/history/actions/ReferenceButton'
import { HistoryModal } from '@/features/history/list/HistoryModal'
import { useSelectionStore } from '@/features/history/selection/selection-store'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, openPreview } from '@/features/preview/preview-store'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'

import type { GenerationRecord } from '../src/core/schemas/generation-record'
import { itemOf, Observer, record, releaseAllSlots } from './helpers/history'
import { upload } from './helpers/validation-fixtures'

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
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

const linkGenerationFile = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('@/lib/api/uploads', () => {
  return { linkGenerationFile }
})

function renderToolbar(): ReactNode {
  return <span>Use media</span>
}

function historyModal(selectedRecord: GenerationRecord) {
  return (
    <HistoryModal
      item={itemOf(selectedRecord)}
      viewOrder={[selectedRecord.id]}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={vi.fn()}
      toolbar={renderToolbar}
    />
  )
}

function previewModal() {
  return <MediaPreviewModal toolbar={renderToolbar} />
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
})

afterEach(() => {
  cleanup()
  useGeneratorStore.setState({ references: [], uploadsById: {} })
  linkGenerationFile.mockReset()
  useHistoryViewerStore.getState().close()
  closePreview()
  releaseAllSlots()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('video reference action', () => {
  it('adds a finished video to the video draft', async () => {
    const saved = record('v')

    linkGenerationFile.mockResolvedValue({
      id: 'ref',
      source: 'file',
      kind: 'video',
      mime: 'video/mp4',
      ext: 'mp4',
      originalName: 'ref.mp4',
      sizeBytes: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    useHistoryViewerStore.getState().navigate(saved.id)
    render(<ReferenceButton item={itemOf(saved)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

    await waitFor(() => {
      expect(linkGenerationFile).toHaveBeenCalledWith({ generationId: saved.id })
    })

    expect(useGeneratorStore.getState().references).toEqual(['ref'])
  })
})

describe('viewer toolbar render props', () => {
  it('renders the supplied HistoryModal toolbar for a completed record', () => {
    useHistoryViewerStore.getState().open('done')

    render(historyModal(record('done')))

    expect(screen.getByText('Use media')).not.toBeNull()
  })

  it('hides the HistoryModal toolbar while selecting', () => {
    const saved = record('completed')

    useHistoryViewerStore.getState().navigate(saved.id)
    useSelectionStore.getState().setMany([saved.id], true)
    render(historyModal(saved))

    expect(screen.queryByText('Use media')).toBeNull()

    useSelectionStore.getState().clear()
  })

  it('renders no HistoryModal toolbar while the record is still running', () => {
    useHistoryViewerStore.getState().open('busy')

    render(historyModal(record('busy', { status: 'in_progress' })))

    expect(screen.queryByText('Use media')).toBeNull()
  })

  it('renders the supplied MediaPreviewModal toolbar unless the opener opts out', () => {
    render(previewModal())

    act(() => {
      openPreview({ items: [upload('image', 'image')], index: 0 })
    })

    expect(screen.getByText('Use media')).not.toBeNull()

    act(() => {
      closePreview()
    })

    act(() => {
      openPreview({ items: [upload('image', 'image')], index: 0, allowUse: false })
    })

    expect(screen.queryByText('Use media')).toBeNull()
  })
})
