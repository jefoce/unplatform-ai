'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { Modal } from '@/ui/Modal'

import { DetailsPanel } from './DetailsPanel'
import { cancelGeneration } from './record-actions'
import { posterSrc, videoSrc } from './record-view'
import { StatusOverlay } from './StatusOverlay'

interface HistoryModalProps {
  record: GenerationRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/** Centered grid preview: 16:9 player left, details panel right. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open: isOpen, onOpenChange: handleOpenChange, onDeleted } = props
  const handleCancel = useCallback(() => {
    if (isNil(record)) return

    void cancelGeneration(record.id)
  }, [record])
  const handleDeleted = useCallback(() => {
    handleOpenChange(false)
    onDeleted?.()
  }, [handleOpenChange, onDeleted])

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Video details"
      className="h-[min(80vh,820px)] w-[min(1100px,92vw)] overflow-hidden bg-surface p-3"
    >
      {!isNil(record) && (
        <div className="flex h-full min-h-0 gap-3">
          <div className="relative aspect-video w-full min-w-0 flex-1 self-center overflow-hidden rounded-2xl bg-black">
            {record.status === 'completed' ? (
              <LazyVideo
                id={`modal-${record.id}`}
                src={videoSrc(record)}
                poster={posterSrc(record, 1280)}
                posterFit="contain"
                videoFit="contain"
                className="size-full"
              />
            ) : (
              <StatusOverlay record={record} fill onCancel={handleCancel} />
            )}
          </div>
          <div
            className="group/card min-h-0 w-70 shrink-0 overflow-hidden"
            style={{ minWidth: DETAILS_MIN_WIDTH }}
          >
            <DetailsPanel record={record} onDeleted={handleDeleted} />
          </div>
        </div>
      )}
    </Modal>
  )
}
