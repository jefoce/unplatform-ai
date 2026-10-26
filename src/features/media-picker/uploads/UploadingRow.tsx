'use client'

import { isNil } from 'lodash-es'

import { type UploadProgressItem, UploadProgressTile } from './UploadProgressTile'

interface UploadingRowProps {
  entry: UploadProgressItem
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
}

/** Wraps an upload entry with per-row retry and dismiss handlers. */
export function UploadingRow(props: UploadingRowProps) {
  const { entry } = props
  let handleRetry: (() => void) | undefined
  let handleDismiss: (() => void) | undefined

  if (!isNil(props.onRetry)) {
    handleRetry = () => {
      return props.onRetry?.(entry.id)
    }
  }

  if (!isNil(props.onDismiss)) {
    handleDismiss = () => {
      return props.onDismiss?.(entry.id)
    }
  }

  return <UploadProgressTile item={entry} onRetry={handleRetry} onDismiss={handleDismiss} />
}
