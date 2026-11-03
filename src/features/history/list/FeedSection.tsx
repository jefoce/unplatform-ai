'use client'

import { type ReactNode, useEffect, useMemo } from 'react'
import { find, isNil, map } from 'lodash-es'

import type { RecordKind } from '@/core/feed/grid-item'
import { useHistoryViewerStore } from '@/features/shared/history-viewer-store'
import { IMAGE_FEED_TOP_PADDING, IMAGE_ISLAND_TOP_PX, SHELL_FRAME } from '@/features/shared/layout'
import { cn } from '@/lib/cn'
import type { HistoryItem } from '@/lib/feed/output-items'
import { useScrollSentinel } from '@/lib/use-scroll-sentinel'

import { useSelectionStore } from '../selection/selection-store'
import { SelectionBar } from '../selection/SelectionBar'
import { useSelectionSync } from '../selection/use-selection-sync'
import { canOpenItem } from './can-open'
import { FeedScrollContext, useFeedScrolled } from './feed-scroll'
import { FeedContent } from './FeedContent'
import { HistoryModal } from './HistoryModal'
import { isSavedItem } from './saved-items'
import { useScrollRestore } from './use-scroll-restore'
import type { HistoryView } from './view-store'

interface FeedPadding {
  base: string
  selecting: string
}

interface FeedSectionProps {
  items: HistoryItem[]
  isLoading: boolean
  hasMore: boolean
  isLoadingMore: boolean
  error: unknown
  loadMore: () => void
  onRetry: () => void
  view: HistoryView
  zoom: number
  filters: object
  toolbar: ReactNode
  emptyKind: RecordKind
  promptBar?: ReactNode
  isSavedOnly?: boolean
  hasList?: boolean
  sectionId?: string
  padding: FeedPadding
  viewerToolbar?: (item: HistoryItem) => ReactNode

  /** `overlay` floats the toolbar over a full-window scroll area. */
  toolbarPlacement?: 'flow' | 'overlay'
}

interface ToolbarSlotParams {
  placement: 'flow' | 'overlay'
  toolbar: ReactNode
}

/** Toolbar in the flow, or floating over the scroll area in its shell frame. */
function toolbarSlot(params: ToolbarSlotParams): ReactNode {
  const { placement, toolbar } = params

  if (placement === 'flow') {
    return toolbar
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <div className={SHELL_FRAME} style={{ paddingTop: IMAGE_ISLAND_TOP_PX }}>
        {toolbar}
      </div>
    </div>
  )
}

/** Scroll area classes for the flow and overlay toolbar placements. */
function scrollClasses(isOverlay: boolean, paddingClass: string): string {
  const placement = isOverlay
    ? 'absolute inset-0 overflow-y-auto px-1'
    : 'min-h-0 flex-1 overflow-y-auto px-4'

  return cn(placement, paddingClass)
}

interface FeedScrollStyle {
  paddingTop: number
}

/** Inline top padding for the overlay feed, undefined in the flow layout. */
function scrollStyle(isOverlay: boolean): FeedScrollStyle | undefined {
  if (!isOverlay) {
    return undefined
  }

  return { paddingTop: IMAGE_FEED_TOP_PADDING }
}

/** Saved-only items for the image feed, every item for video. */
function feedItems(items: HistoryItem[], isSavedOnly: boolean): HistoryItem[] {
  if (!isSavedOnly) {
    return items
  }

  return items.filter(isSavedItem)
}

/** One history feed shell for the video and image workspaces. */
export function FeedSection(props: FeedSectionProps) {
  const { items, view, zoom, filters, hasMore, loadMore, isSavedOnly = false } = props
  const isOverlay = props.toolbarPlacement === 'overlay'
  const placement = isOverlay ? 'overlay' : 'flow'

  const isSelecting = useSelectionStore((state) => {
    return state.ids.size > 0
  })

  const selectedId = useHistoryViewerStore((state) => {
    return state.selectedId
  })

  const navigate = useHistoryViewerStore((state) => {
    return state.navigate
  })

  const isViewerOpen = !isNil(selectedId)
  const sentinel = useScrollSentinel(hasMore, loadMore)
  const { scrollRef, handleScroll } = useScrollRestore(isViewerOpen)
  const isScrolled = useFeedScrolled(scrollRef, isOverlay)

  useSelectionSync(items)

  useEffect(() => {
    useSelectionStore.getState().clear()
  }, [view, filters])

  const viewItems = useMemo(() => {
    return feedItems(items, isSavedOnly)
  }, [items, isSavedOnly])

  const selected = find(viewItems, (item) => {
    return item.id === selectedId
  })

  const viewOrder = useMemo(() => {
    return map(viewItems, 'id')
  }, [viewItems])

  const paddingClass = isSelecting ? props.padding.selecting : props.padding.base

  const handleOpen = (item: HistoryItem) => {
    if (!canOpenItem(item)) {
      return
    }

    navigate(item.id)
  }

  return (
    <section id={props.sectionId} className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <FeedScrollContext.Provider value={isScrolled}>
        {toolbarSlot({ placement, toolbar: props.toolbar })}
      </FeedScrollContext.Provider>
      <div
        ref={scrollRef}
        className={scrollClasses(isOverlay, paddingClass)}
        style={scrollStyle(isOverlay)}
        onScroll={handleScroll}
      >
        <FeedContent
          items={items}
          isLoading={props.isLoading}
          error={props.error}
          view={view}
          zoom={zoom}
          emptyKind={props.emptyKind}
          hasList={props.hasList === true}
          onOpen={handleOpen}
          onRetry={props.onRetry}
          onNearEnd={loadMore}
        />
        {hasMore && view !== 'masonry' && <div ref={sentinel} className="h-8" />}
      </div>
      {!isNil(props.promptBar) && !isSelecting && (
        <div className="absolute inset-x-0 bottom-3 z-40 flex justify-center">
          {props.promptBar}
        </div>
      )}
      <SelectionBar items={items} />
      <HistoryModal
        item={selected ?? null}
        viewOrder={viewOrder}
        hasMore={hasMore}
        isLoadingMore={props.isLoadingMore}
        onLoadMore={loadMore}
        toolbar={props.viewerToolbar}
      />
    </section>
  )
}
