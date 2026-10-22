'use client'

import { useCallback, useState } from 'react'
import { isNil } from 'lodash-es'
import { Trash2 } from 'lucide-react'

import type { GenerationRecord } from '@/core/types'
import { formatDate } from '@/lib/format'
import { Button } from '@/ui/Button'

import { DeleteConfirm } from './DeleteConfirm'
import { totalTime } from './details-info'
import { DetailsActionButtons } from './DetailsActionButtons'
import { ErrorDetailsPopover } from './ErrorDetailsPopover'
import { MoreMenu } from './MoreMenu'
import { rerunRecord, saveRecordVideo, toggleFavorite } from './record-actions'
import { recordError } from './record-view'

interface DetailsActionsProps {
  record: GenerationRecord
  isActive: boolean
  now: number
  onDeleted?: () => void
}

/** Timestamps on the left, hover actions on the right, delete dialog for failed records. */
export function DetailsActions(props: DetailsActionsProps) {
  const { record, isActive, now, onDeleted: handleDeleted } = props
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const handleConfirmOpenChange = setIsConfirmOpen
  const isFailed = record.status === 'failed'
  const friendly = isFailed ? recordError(record) : null

  const handleReuse = useCallback(() => void rerunRecord(record), [record])
  const handleDownload = useCallback(() => void saveRecordVideo(record), [record])
  const handleFavorite = useCallback(() => void toggleFavorite(record), [record])
  const handleOpenDelete = useCallback(() => setIsConfirmOpen(true), [])

  return (
    <>
      <div className="relative mt-auto h-6 shrink-0">
        <div className="flex h-6 items-center justify-between text-xs text-fg-2 transition-opacity duration-150 group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-focus-visible/card:pointer-events-none group-has-focus-visible/card:opacity-0 group-has-data-[state=open]/card:pointer-events-none group-has-data-[state=open]/card:opacity-0">
          <span>{formatDate(record.createdAt)}</span>
          <span className="tabular-nums">{totalTime(record, isActive ? now : undefined)}</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex h-6 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-focus-visible/card:pointer-events-auto group-has-focus-visible/card:opacity-100 group-has-data-[state=open]/card:pointer-events-auto group-has-data-[state=open]/card:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg hover:bg-hover"
            onClick={handleReuse}
          >
            Reuse
          </Button>
          {!isNil(friendly) && (
            <ErrorDetailsPopover
              error={friendly}
              className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg"
            />
          )}
          <DetailsActionButtons
            record={record}
            onDownload={handleDownload}
            onFavorite={handleFavorite}
          />
          {isFailed ? (
            <button
              type="button"
              aria-label="Remove"
              onClick={handleOpenDelete}
              className="ml-auto inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          ) : (
            <MoreMenu
              record={record}
              onDeleted={handleDeleted}
              variant="panel"
              className="ml-auto h-6 w-7.5 rounded-lg border-0"
            />
          )}
        </div>
      </div>
      <DeleteConfirm
        record={record}
        open={isConfirmOpen}
        onOpenChange={handleConfirmOpenChange}
        onDeleted={handleDeleted}
      />
    </>
  )
}
