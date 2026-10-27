// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DetailsPanel } from '@/features/history/details/DetailsPanel'
import { useHistoryViewerStore } from '@/features/history/list/history-viewer-store'
import { closePreview, openPreview, usePreviewStore } from '@/features/preview/preview-store'

import { Observer, record } from './helpers/history'
import { upload } from './helpers/validation-fixtures'

const rerunRecord = vi.hoisted(() => {
  return vi.fn()
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
  return { toast: { success: vi.fn(), error: vi.fn() } }
})

vi.mock('@/features/history/actions/record-actions', async (importOriginal) => {
  const actual = await importOriginal<{ rerunRecord: typeof rerunRecord }>()

  return { ...actual, rerunRecord }
})

const RECORD_ID = 'v'
const linkedVideo = upload('linked', 'video')

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  vi.clearAllMocks()
  rerunRecord.mockReset()
  rerunRecord.mockResolvedValue(true)
  closePreview()
  useHistoryViewerStore.getState().close()
})

afterEach(() => {
  cleanup()
  closePreview()
  useHistoryViewerStore.getState().close()
  vi.unstubAllGlobals()
})

describe('details actions', () => {
  it('closes the preview and the history viewer when Reuse loads the draft', async () => {
    openPreview({ items: [linkedVideo], index: 0 })
    useHistoryViewerStore.getState().open(RECORD_ID)
    render(<DetailsPanel record={record(RECORD_ID)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reuse' }))

    await waitFor(() => {
      expect(usePreviewStore.getState().request).toBeNull()
    })

    expect(useHistoryViewerStore.getState().selectedId).toBeNull()
  })
})
