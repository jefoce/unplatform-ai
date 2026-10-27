'use client'

import { type ReactNode, useEffect, useMemo } from 'react'
import { isEmpty } from 'lodash-es'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { useGeneratorStore } from '@/features/generator/store/store'
import { ViewerUseButton } from '@/features/viewers/ViewerUseButton'
import { cn } from '@/lib/cn'

import { isSelectable } from '../actions/record-view'
import { useSelectionStore } from '../selection/selection-store'
import { SelectionBar } from '../selection/SelectionBar'
import { useJobNotifications } from '../status/use-job-notifications'
import { EmptyState } from './EmptyState'
import { useHistoryViewerStore } from './history-viewer-store'
import { HistoryGrid } from './HistoryGrid'
import { HistoryList } from './HistoryList'
import { HistoryModal } from './HistoryModal'
import { HistoryToolbar } from './HistoryToolbar'
import { SkeletonRows } from './SkeletonRows'
import { useHistory } from './use-history'
import { useHistoryScroll } from './use-history-scroll'
import { useHistoryViewStore } from './view-store'

/** Use button for the completed record shown in the history viewer. */
function renderHistoryToolbar(record: GenerationRecord): ReactNode {
  return <ViewerUseButton target={{ kind: 'record', record }} />
}

/** Right-hand feed: toolbar, list or grid, infinite scroll and grid details modal. */
export function HistorySection() {
  const { records, activeCount, isLoading, isValidating, hasMore, loadMore } = useHistory()

  const view = useHistoryViewStore((state) => {
    return state.view
  })

  const filters = useHistoryViewStore((state) => {
    return state.filters
  })

  const isSelecting = useSelectionStore((state) => {
    return state.ids.size > 0
  })

  const setActiveCount = useGeneratorStore((state) => {
    return state.setActiveCount
  })

  const selectedId = useHistoryViewerStore((state) => {
    return state.selectedId
  })

  const navigate = useHistoryViewerStore((state) => {
    return state.navigate
  })

  const selected =
    records.find((record) => {
      return record.id === selectedId
    }) ?? null

  const order = useMemo(() => {
    return records.filter(isSelectable).map((record) => {
      return record.id
    })
  }, [records])

  const viewOrder = useMemo(() => {
    return records.map((record) => {
      return record.id
    })
  }, [records])

  const paddingClass = isSelecting ? 'pb-28' : 'pb-14'

  const handleOpen = (record: GenerationRecord) => {
    navigate(record.id)
  }

  useJobNotifications({ records, activeCount, isLoading })

  useEffect(() => {
    setActiveCount(activeCount)
  }, [activeCount, setActiveCount])

  // Filter, search and view changes end the selection. Zoom and polling do not.
  useEffect(() => {
    useSelectionStore.getState().clear()
  }, [view, filters])

  useEffect(() => {
    useSelectionStore.getState().setOrder(order)
  }, [order])

  useEffect(() => {
    useSelectionStore.getState().prune(new Set(viewOrder))
  }, [viewOrder])

  const sentinel = useHistoryScroll(hasMore, loadMore)

  return (
    <section id="history-section" className="relative flex h-full flex-col overflow-hidden">
      <HistoryToolbar />
      <div className={cn('flex-1 overflow-y-auto px-4', paddingClass)}>
        {isLoading && isEmpty(records) && <SkeletonRows />}
        {!isLoading && isEmpty(records) && <EmptyState />}
        {view === 'list' && <HistoryList records={records} />}
        {view !== 'list' && <HistoryGrid records={records} onOpen={handleOpen} />}
        {hasMore && <div ref={sentinel} className="h-8" />}
      </div>
      <SelectionBar records={records} />
      <HistoryModal
        record={selected}
        viewOrder={viewOrder}
        hasMore={hasMore}
        isLoadingMore={isValidating}
        onLoadMore={loadMore}
        toolbar={renderHistoryToolbar}
      />
    </section>
  )
}
