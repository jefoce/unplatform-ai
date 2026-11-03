'use client'

import { isEmpty, isNil } from 'lodash-es'

import type { RecordKind } from '@/core/feed/grid-item'
import type { HistoryItem } from '@/lib/feed/output-items'

import { EmptyState } from './EmptyState'
import { FeedRetry } from './FeedRetry'
import { HistoryGrid } from './HistoryGrid'
import { HistoryList } from './HistoryList'
import { MasonryGrid } from './MasonryGrid'
import { SkeletonRows } from './SkeletonRows'
import type { HistoryView } from './view-store'

export interface FeedContentProps {
  items: HistoryItem[]
  isLoading: boolean
  error: unknown
  view: HistoryView
  zoom: number
  emptyKind: RecordKind
  hasList: boolean
  onOpen: (item: HistoryItem) => void
  onRetry: () => void
  onNearEnd: () => void
}

interface FeedStateParams {
  items: HistoryItem[]
  isLoading: boolean
  error: unknown
}

interface FeedState {
  isInitialLoading: boolean
  isFirstPageError: boolean
  isEmptyFeed: boolean
}

/** Loading, first-page error and empty flags for one feed state. */
function feedState(params: FeedStateParams): FeedState {
  const { items, isLoading, error } = params
  const isFirstPageError = !isNil(error) && isEmpty(items)

  return {
    isInitialLoading: isLoading && isEmpty(items),
    isFirstPageError,
    isEmptyFeed: !isLoading && isEmpty(items) && isNil(error),
  }
}

/** Skeleton, retry, empty copy and the selected list, grid or masonry view. */
export function FeedContent(props: FeedContentProps) {
  const { items, isLoading, error, view, zoom, emptyKind, hasList } = props

  const { isInitialLoading, isFirstPageError, isEmptyFeed } = feedState({
    items,
    isLoading,
    error,
  })

  return (
    <>
      {isInitialLoading && <SkeletonRows />}
      {isFirstPageError && <FeedRetry error={error} onRetry={props.onRetry} />}
      {isEmptyFeed && <EmptyState kind={emptyKind} />}
      {hasList && view === 'list' && <HistoryList items={items} />}
      {view === 'grid' && <HistoryGrid items={items} zoom={zoom} onOpen={props.onOpen} />}
      {view === 'masonry' && (
        <MasonryGrid items={items} zoom={zoom} onOpen={props.onOpen} onNearEnd={props.onNearEnd} />
      )}
    </>
  )
}
