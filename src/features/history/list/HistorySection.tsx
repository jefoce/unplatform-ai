'use client'

import { type ReactNode, useEffect, useMemo } from 'react'

import { useGeneratorStore } from '@/features/generator/store/store'
import { ViewerUseButton } from '@/features/viewers/ViewerUseButton'
import { type HistoryItem, isVideoItem, videoItem } from '@/lib/feed/output-items'

import { FeedSection } from './FeedSection'
import { HistoryToolbar } from './HistoryToolbar'
import { useHistoryFeed } from './use-history'
import { useStableItems } from './use-stable-items'
import { useHistoryViewStore } from './view-store'

/** The viewer's single use action: Reference or Start frame, by mode. */
export function renderHistoryToolbar(item: HistoryItem): ReactNode {
  if (!isVideoItem(item)) {
    return null
  }

  return <ViewerUseButton target={{ kind: 'record', record: item.source }} />
}

/** Video feed: toolbar, list or grid, infinite scroll and grid details modal. */
export function HistorySection() {
  const { records, activeCount, isLoading, isValidating, hasMore, error, loadMore, retry } =
    useHistoryFeed()

  const view = useHistoryViewStore((state) => {
    return state.view
  })

  const zoom = useHistoryViewStore((state) => {
    return state.zoom
  })

  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const setActiveCount = useGeneratorStore((state) => {
    return state.setActiveCount
  })

  const loadedItems = useMemo(() => {
    return records.map(videoItem)
  }, [records])

  const items = useStableItems(loadedItems)

  useEffect(() => {
    setActiveCount(activeCount)
  }, [activeCount, setActiveCount])

  return (
    <FeedSection
      items={items}
      isLoading={isLoading}
      hasMore={hasMore}
      isLoadingMore={isValidating}
      error={error}
      onRetry={retry}
      loadMore={loadMore}
      view={view}
      zoom={zoom}
      filters={filters}
      toolbar={<HistoryToolbar />}
      emptyKind="video"
      hasList
      sectionId="history-section"
      padding={{ base: 'pb-14', selecting: 'pb-28' }}
      viewerToolbar={renderHistoryToolbar}
    />
  )
}
