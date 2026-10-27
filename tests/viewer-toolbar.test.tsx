// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { HistoryModal } from '@/features/history/list/HistoryModal'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { closePreview, openPreview } from '@/features/preview/preview-store'

import { Observer, record, releaseAllSlots } from './helpers/history'
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

function renderToolbar(): ReactNode {
  return <span>Use media</span>
}

function historyModal(selectedRecord: GenerationRecord) {
  return (
    <HistoryModal
      record={selectedRecord}
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
  useHistoryViewerStore.getState().close()
  closePreview()
  releaseAllSlots()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('viewer toolbar render props', () => {
  it('renders the supplied HistoryModal toolbar for a completed record', () => {
    useHistoryViewerStore.getState().open('done')

    render(historyModal(record('done')))

    expect(screen.getByText('Use media')).not.toBeNull()
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
