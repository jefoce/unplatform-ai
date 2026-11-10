'use client'

import { type ReactNode } from 'react'

import { ReferenceButton } from '@/features/history/actions/ReferenceButton'
import { FeedSection } from '@/features/history/list/FeedSection'
import { imagePageKey } from '@/lib/api/images'
import { type HistoryItem, isImageItem } from '@/lib/feed/output-items'

import { useImageViewStore } from './image-view-store'
import { WorkspaceIsland } from './WorkspaceIsland'

/** Reference action for a saved image output in the viewer. */
export function renderImageToolbar(item: HistoryItem): ReactNode {
  if (!isImageItem(item)) {
    return null
  }

  return <ReferenceButton item={item} />
}

interface ImageWorkspaceProps {
  items: HistoryItem[]
  isLoading: boolean
  hasMore: boolean
  isLoadingMore: boolean
  error: unknown
  loadMore: () => void
  onRetry: () => Promise<unknown>

  /** Lead mounts the floating image prompt bar here at integration. */
  promptBar?: ReactNode
}

/** Image tab: glass island, grid or masonry feed, prompt bar slot. */
export function ImageWorkspace(props: ImageWorkspaceProps) {
  const { items, isLoading, hasMore, isLoadingMore, loadMore, promptBar } = props

  const view = useImageViewStore((state) => {
    return state.view
  })

  const zoom = useImageViewStore((state) => {
    return state.zoom
  })

  const filters = useImageViewStore((state) => {
    return state.filters
  })

  const pageKey = imagePageKey(filters)

  return (
    <div className="h-full" data-image-page-key={pageKey}>
      <FeedSection
        items={items}
        isLoading={isLoading}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        error={props.error}
        onRetry={props.onRetry}
        loadMore={loadMore}
        view={view}
        zoom={zoom}
        filters={filters}
        toolbar={<WorkspaceIsland />}
        toolbarPlacement="overlay"
        emptyKind="image"
        isSavedOnly
        promptBar={promptBar}
        padding={{ base: 'pb-60', selecting: 'pb-60' }}
        viewerToolbar={renderImageToolbar}
      />
    </div>
  )
}
