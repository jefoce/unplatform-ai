'use client'

import type { VideoGridItem } from '@/lib/feed/output-items'

import { endpointOfflineView, videoStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { useRecordOffline } from '../status/use-record-offline'

interface HistoryModalStatusProps {
  item: VideoGridItem
  onCancel: () => void
}

/** Running status in the viewer. The details panel owns its menu. */
export function HistoryModalStatus(props: HistoryModalStatusProps) {
  const { item } = props
  const isOffline = useRecordOffline(item.source)

  const base = videoStatusView(item.source, props.onCancel)
  let view = base

  if (isOffline) {
    view = endpointOfflineView(base)
  }

  return <StatusOverlay view={view} />
}
