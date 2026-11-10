'use client'

import type { ReactNode } from 'react'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cancelGeneration } from '@/features/generator/generate/cancel-generation'
import { videoItem } from '@/lib/feed/output-items'

import { MoreMenu } from '../actions/MoreMenu'
import { isCustomActiveRecord } from '../status/status-tone'
import { endpointOfflineView, videoStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { useRecordOffline } from '../status/use-record-offline'
import { TILE_RADIUS } from './tile-radius'

interface HistoryRowStatusProps {
  record: GenerationRecord
}

/** Running or failed status for the list row media box. */
export function HistoryRowStatus(props: HistoryRowStatusProps) {
  const { record } = props
  const isOffline = useRecordOffline(record)

  const handleCancel = () => {
    void cancelGeneration(record.id)
  }

  const base = videoStatusView(record, handleCancel)
  let view = base

  if (isOffline) {
    view = endpointOfflineView(base)
  }

  let menu: ReactNode = null

  if (isCustomActiveRecord(record)) {
    menu = <MoreMenu item={videoItem(record)} />
  }

  return <StatusOverlay view={view} fill menu={menu} className={TILE_RADIUS.list.video} />
}
