'use client'

import { isNil } from 'lodash-es'
import { Trash2 } from 'lucide-react'

import type { FriendlyError } from '@/core/provider-errors/types'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { closeViewers } from '@/features/viewers/close-viewers'
import { formatDate } from '@/lib/format'
import { useAsyncAction } from '@/lib/use-async-action'
import { useBoolean } from '@/lib/use-boolean'
import { Button } from '@/ui/Button'

import { DeleteConfirm } from '../actions/DeleteConfirm'
import { MoreMenu } from '../actions/MoreMenu'
import { rerunRecord, saveRecordVideo, toggleFavorite } from '../actions/record-actions'
import { recordError } from '../actions/record-view'
import { ErrorDetailsPopover } from '../status/ErrorDetailsPopover'
import { totalTime } from './details-info'
import { DetailsActionButtons } from './DetailsActionButtons'

interface DetailsActionsProps {
  record: GenerationRecord
  isActive: boolean
  now: number
  onDeleted?: () => void
}

/** Friendly error for failed records, null for every other status. */
function failedRecordError(record: GenerationRecord): FriendlyError | null {
  if (record.status !== 'failed') {
    return null
  }

  return recordError(record)
}

interface DetailsFooterParams {
  record: GenerationRecord
}

/** Actions and the error shown for one details record. */
function useDetailsFooter(params: DetailsFooterParams) {
  const { record } = params
  const friendly = failedRecordError(record)

  const reuse = useAsyncAction(async () => {
    const isLoaded = await rerunRecord(record)

    if (!isLoaded) {
      return
    }

    closeViewers()
  })

  const handleDownload = () => {
    return void saveRecordVideo(record)
  }

  const handleFavorite = () => {
    return void toggleFavorite(record)
  }

  return { friendly, handleDownload, handleFavorite, reuse }
}

/** Timestamps on the left, hover actions on the right, delete dialog for failed records. */
export function DetailsActions(props: DetailsActionsProps) {
  const { record, isActive, now } = props
  const confirmDialog = useBoolean()
  const { friendly, handleDownload, handleFavorite, reuse } = useDetailsFooter(props)

  const isFailed = record.status === 'failed'
  const timeNow = isActive ? now : undefined

  return (
    <>
      <div className="relative mt-auto h-6 shrink-0">
        <div className="flex h-6 items-center justify-between text-xs text-fg-2 transition-opacity duration-150 group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-focus-visible/card:pointer-events-none group-has-focus-visible/card:opacity-0 group-has-data-[state=open]/card:pointer-events-none group-has-data-[state=open]/card:opacity-0">
          <span>{formatDate(record.createdAt)}</span>
          <span className="tabular-nums">{totalTime(record, timeNow)}</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex h-6 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-focus-visible/card:pointer-events-auto group-has-focus-visible/card:opacity-100 group-has-data-[state=open]/card:pointer-events-auto group-has-data-[state=open]/card:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg hover:bg-hover"
            onClick={reuse.run}
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
          {isFailed && (
            <button
              type="button"
              aria-label="Remove"
              onClick={confirmDialog.on}
              className="ml-auto inline-flex h-6 w-7.5 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
          {!isFailed && (
            <MoreMenu
              record={record}
              onDeleted={props.onDeleted}
              variant="panel"
              className="ml-auto h-6 w-7.5 rounded-lg border-0"
            />
          )}
        </div>
      </div>
      <DeleteConfirm
        record={record}
        open={confirmDialog.value}
        onOpenChange={confirmDialog.set}
        onDeleted={props.onDeleted}
      />
    </>
  )
}
