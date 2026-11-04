// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import { HistoryModal } from '@/features/history/list/HistoryModal'
import { renderHistoryToolbar } from '@/features/history/list/HistorySection'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { renderImageToolbar } from '@/features/workspace/ImageWorkspace'

import { handleNoop, itemOf, Observer, record, releaseAllSlots } from './helpers/history'
import { imageItemsOf } from './helpers/image-history'
import { required } from './helpers/required'

const video = record('video')
const image = required(imageItemsOf(['3f2504e0-4f89-41d3-9a0c-0305e82c3401'])[0], 'image item')

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('ResizeObserver', Observer)
  useGeneratorStore.setState({ tab: 'references', references: [], uploadsById: {} })
  useHistoryViewerStore.getState().close()
})

afterEach(() => {
  cleanup()
  useHistoryViewerStore.getState().close()
  releaseAllSlots()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('viewer use action', () => {
  it('renders exactly one Reference button for a completed video', () => {
    useHistoryViewerStore.getState().open(video.id)

    render(
      <HistoryModal
        item={itemOf(video)}
        viewOrder={[video.id]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={handleNoop}
        toolbar={renderHistoryToolbar}
      />,
    )

    const toolbar = required(
      screen.getByRole('dialog').querySelector<HTMLElement>('[data-slot="toolbar"]'),
      'viewer toolbar',
    )

    expect(within(toolbar).getAllByRole('button', { name: 'Reference' })).toHaveLength(1)
  })

  it('renders exactly one Reference button for a completed image', () => {
    useHistoryViewerStore.getState().open(image.id)

    render(
      <HistoryModal
        item={image}
        viewOrder={[image.id]}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={handleNoop}
        toolbar={renderImageToolbar}
      />,
    )

    const toolbar = required(
      screen.getByRole('dialog').querySelector<HTMLElement>('[data-slot="toolbar"]'),
      'viewer toolbar',
    )

    expect(within(toolbar).getAllByRole('button', { name: 'Reference' })).toHaveLength(1)
  })
})
