'use client'

import type { ReactNode } from 'react'

import type { VideoGridItem } from '@/lib/feed/output-items'

import { MoreMenu } from '../actions/MoreMenu'
import { isCustomActiveRecord } from '../status/status-tone'
import { endpointOfflineView, videoStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { useRecordOffline } from '../status/use-record-offline'

interface HistoryModalStatusProps {
  item: VideoGridItem
  onCancel: () => void
}

/** Running status in the viewer, with the endpoint menu for a custom job. */
export function HistoryModalStatus(props: HistoryModalStatusProps) {
  const { item } = props
  const isOffline = useRecordOffline(item.source)

  const base = videoStatusView(item.source, props.onCancel)
  let view = base

  if (isOffline) {
    view = endpointOfflineView(base)
  }

  let menu: ReactNode = null

  if (isCustomActiveRecord(item.source)) {
    menu = <MoreMenu item={item} />
  }

  return <StatusOverlay view={view} menu={menu} />
}
