'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isEmpty } from 'lodash-es'

import type { GenerationRecord } from '@/core/types'
import { useGeneratorStore } from '@/features/generator/store'
import { cn } from '@/lib/cn'

import { EmptyState } from './EmptyState'
import { HistoryGrid } from './HistoryGrid'
import { HistoryList } from './HistoryList'
import { HistoryModal } from './HistoryModal'
import { HistoryToolbar } from './HistoryToolbar'
import { isSelectable } from './record-view'
import { useSelectionStore } from './selection-store'
import { SelectionBar } from './SelectionBar'
import { SkeletonRows } from './SkeletonRows'
import { useHistory } from './use-history'
import { useJobNotifications } from './use-job-notifications'
import { useHistoryViewStore } from './view-store'

/** Right-hand feed: toolbar, list or grid, infinite scroll and grid details modal. */
export function HistorySection() {
  const { records, activeCount, isLoading, hasMore, loadMore } = useHistory()
  const view = useHistoryViewStore((state) => state.view)
  const filters = useHistoryViewStore((state) => state.filters)
  const isSelecting = useSelectionStore((state) => state.ids.size > 0)
  const setActiveCount = useGeneratorStore((state) => state.setActiveCount)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = records.find((record) => record.id === selectedId) ?? null
  const sentinel = useRef<HTMLDivElement>(null)
  const order = useMemo(() => records.filter(isSelectable).map((record) => record.id), [records])
  const handleOpen = useCallback((record: GenerationRecord) => setSelectedId(record.id), [])
  const handleDeleted = useCallback(() => setSelectedId(null), [])
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setSelectedId(null)
  }, [])

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
    useSelectionStore.getState().prune(new Set(records.map((record) => record.id)))
  }, [records])

  useEffect(() => {
    const node = sentinel.current

    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <section id="history-section" className="relative flex h-full flex-col overflow-hidden">
      <HistoryToolbar />
      <div className={cn('flex-1 overflow-y-auto px-4', isSelecting ? 'pb-28' : 'pb-14')}>
        {isLoading && isEmpty(records) && <SkeletonRows />}
        {!isLoading && isEmpty(records) && <EmptyState />}
        {view === 'list' ? (
          <HistoryList records={records} />
        ) : (
          <HistoryGrid records={records} onOpen={handleOpen} />
        )}
        {hasMore && <div ref={sentinel} className="h-8" />}
      </div>
      <SelectionBar records={records} />
      <HistoryModal
        record={selected}
        open={Boolean(selected)}
        onOpenChange={handleOpenChange}
        onDeleted={handleDeleted}
      />
    </section>
  )
}
