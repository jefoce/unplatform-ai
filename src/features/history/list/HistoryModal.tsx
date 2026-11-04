'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import { cancelGeneration } from '@/features/generator/generate/cancel-generation'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { blurThumbUrl } from '@/lib/api/media-urls'
import { type HistoryItem, isVideoItem, posterSrc } from '@/lib/feed/output-items'
import { preloadPosters } from '@/lib/preload-posters'
import { useChainKeys } from '@/lib/use-chain-keys'
import { Modal } from '@/ui/Modal'

import { DetailsPanel } from '../details/DetailsPanel'
import { useSelectionStore } from '../selection/selection-store'
import { HistoryModalMedia } from './HistoryModalMedia'
import { isSavedItem } from './saved-items'
import { useHistoryNav } from './use-history-nav'

interface HistoryModalProps {
  item: HistoryItem | null
  viewOrder: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  toolbar?: (item: HistoryItem) => ReactNode
}

function itemPoster(item: HistoryItem | null): string | undefined {
  if (isNil(item)) {
    return undefined
  }

  if (item.recordKind === 'video') {
    const poster = posterSrc(item.source, 64)

    if (isNil(poster)) {
      return undefined
    }

    return blurThumbUrl(poster)
  }

  if (item.thumbSrc === '') {
    return undefined
  }

  return blurThumbUrl(item.thumbSrc)
}

/** Blurred backdrop: the item thumb when it has one, else its id gradient. */
function stageBackdrop(item: HistoryItem, poster: string | undefined) {
  if (isNil(poster)) {
    return { kind: 'gradient' as const, seed: item.id }
  }

  return { kind: 'image' as const, src: poster }
}

function handleOpenChange(isNextOpen: boolean): void {
  if (!isNextOpen) {
    useHistoryViewerStore.getState().close()
  }
}

interface RecordToolbarParams {
  item: HistoryItem | null
  render: ((item: HistoryItem) => ReactNode) | undefined
  isSelecting: boolean
}

/** Toolbar node for a saved item, hidden while selecting or unfinished. */
function recordToolbar(params: RecordToolbarParams): ReactNode {
  const { item, render, isSelecting } = params

  if (isSelecting || isNil(render) || isNil(item) || !isSavedItem(item)) {
    return null
  }

  return render(item)
}

/** Viewer state with stable action references. */
function useHistoryViewer() {
  return useHistoryViewerStore(
    useShallow((state) => {
      return { selectedId: state.selectedId, navigate: state.navigate, close: state.close }
    }),
  )
}

/** Centered grid preview: media left, details panel right, item navigation. */
export function HistoryModal(props: HistoryModalProps) {
  const { item, viewOrder, hasMore, isLoadingMore } = props
  const { selectedId, navigate, close } = useHistoryViewer()

  const isSelecting = useSelectionStore((state) => {
    return state.ids.size > 0
  })

  const isOpen = !isNil(selectedId)
  const backdropPoster = itemPoster(item)

  const nav = useHistoryNav({
    selectedId,
    viewOrder,
    hasMore,
    isLoadingMore,
    navigate,
    onLoadMore: props.onLoadMore,
    close,
  })

  const scopeRef = useRef<HTMLDivElement>(null)

  useChainKeys({
    isEnabled: isOpen,
    onPrevious: nav.onPrevious,
    onNext: nav.onNext,
    scopeRef,
  })

  useEffect(() => {
    preloadPosters([backdropPoster])
  }, [backdropPoster])

  const handleCancel = () => {
    if (isNil(item) || !isVideoItem(item)) {
      return
    }

    void cancelGeneration(item.source.id)
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Item details"
      backdropClassName="bg-black/80"
      showClose
      className="h-[calc(100vh-48px)] max-h-275 w-[calc(100vw-48px)] max-w-450 overflow-hidden bg-page-2 p-3"
    >
      {!isNil(item) && (
        <div ref={scopeRef} className="flex h-full min-h-0 flex-col gap-3 compact:flex-row">
          <div className="flex min-h-[50vh] min-w-0 flex-1 compact:min-h-0">
            <HistoryModalMedia
              item={item}
              nav={nav}
              toolbar={recordToolbar({ item, render: props.toolbar, isSelecting })}
              backdrop={stageBackdrop(item, backdropPoster)}
              onCancel={handleCancel}
            />
          </div>
          <div
            className="group/card min-h-0 w-80 shrink-0 overflow-hidden"
            style={{ minWidth: DETAILS_MIN_WIDTH }}
          >
            <DetailsPanel item={item} topRightInset />
          </div>
        </div>
      )}
    </Modal>
  )
}
