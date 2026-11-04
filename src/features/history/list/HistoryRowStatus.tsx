'use client'

import type { GenerationRecord } from '@/core/schemas/generation-record'
import { cancelGeneration } from '@/features/generator/generate/cancel-generation'

import { videoStatusView } from '../status/status-view'
import { StatusOverlay } from '../status/StatusOverlay'
import { TILE_RADIUS } from './tile-radius'

interface HistoryRowStatusProps {
  record: GenerationRecord
}

/** Running or failed status for the list row media box. */
export function HistoryRowStatus(props: HistoryRowStatusProps) {
  const { record } = props

  const handleCancel = () => {
    void cancelGeneration(record.id)
  }

  return (
    <StatusOverlay
      view={videoStatusView(record, handleCancel)}
      fill
      className={TILE_RADIUS.list.video}
    />
  )
}
