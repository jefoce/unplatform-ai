'use client'

import { isNil } from 'lodash-es'
import { X } from 'lucide-react'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'

import { ProgressRing } from './ProgressRing'

export interface UploadProgressItem {
  id: string
  file: File
  progress: number
  error?: string
}

export interface UploadProgressTileProps {
  item: UploadProgressItem
  onRetry?: () => void
  onDismiss?: () => void
}

/** Dashed placeholder for a file being copied into app storage. */
export function UploadProgressTile(props: UploadProgressTileProps) {
  const { item } = props
  const hasError = isNonEmptyString(item.error)

  return (
    <div
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-divider bg-white/2 p-2 text-center',
        hasError && 'border-danger/50 bg-danger/10',
      )}
    >
      {hasError && (
        <>
          <span className="line-clamp-2 text-xxs break-all text-danger">{item.file.name}</span>
          <span className="text-xxs text-danger">Failed</span>
          <div className="flex items-center gap-1">
            {!isNil(props.onRetry) && (
              <button
                type="button"
                onClick={props.onRetry}
                className="rounded-sm px-1.5 py-0.5 text-xxs font-medium text-fg transition hover:bg-white/10"
              >
                Retry
              </button>
            )}
            {!isNil(props.onDismiss) && (
              <button
                type="button"
                onClick={props.onDismiss}
                aria-label="Dismiss upload"
                className="rounded-sm p-0.5 text-fg-2 transition hover:bg-white/10 hover:text-fg"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </>
      )}
      {!hasError && (
        <>
          <ProgressRing value={item.progress} />
          <span className="line-clamp-2 text-xxs break-all text-fg-2">{item.file.name}</span>
        </>
      )}
    </div>
  )
}
