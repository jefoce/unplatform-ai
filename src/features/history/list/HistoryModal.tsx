'use client'

import { isNil } from 'lodash-es'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { LazyVideo } from '@/features/player/LazyVideo'
import { Modal } from '@/ui/Modal'

import { cancelGeneration } from '../actions/record-actions'
import { posterSrc, videoSrc } from '../actions/record-view'
import { DetailsPanel } from '../details/DetailsPanel'
import { StatusOverlay } from '../status/StatusOverlay'

interface HistoryModalProps {
  record: GenerationRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/** Centered grid preview: 16:9 player left, details panel right. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open: isOpen } = props

  const handleCancel = () => {
    if (isNil(record)) {
      return
    }

    void cancelGeneration(record.id)
  }

  const handleDeleted = () => {
    props.onOpenChange(false)
    props.onDeleted?.()
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={props.onOpenChange}
      label="Video details"
      className="h-[min(80vh,820px)] w-[min(1100px,92vw)] overflow-hidden bg-surface p-3"
    >
      {!isNil(record) && (
        <div className="flex h-full min-h-0 gap-3">
          <div className="relative aspect-video w-full min-w-0 flex-1 self-center overflow-hidden rounded-2xl bg-black">
            {record.status === 'completed' && (
              <LazyVideo
                id={`modal-${record.id}`}
                src={videoSrc(record)}
                poster={posterSrc(record, 1280)}
                posterFit="contain"
                videoFit="contain"
                className="size-full"
              />
            )}
            {record.status !== 'completed' && (
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
