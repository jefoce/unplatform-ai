'use client'

import { isNil } from 'lodash-es'

import { KIND_TITLE } from '@/core/media-kinds'
import type { UploadItem } from '@/core/schemas/upload-item'
import { formatBytes, formatSecondsShort } from '@/lib/format'

interface PreviewMetaProps {
  item: UploadItem
}

/** Kind, size and length chips for the preview header. */
export function PreviewMeta(props: PreviewMetaProps) {
  const { item } = props

  return (
    <>
      <span>{KIND_TITLE[item.kind]}</span>
      <span>{formatBytes(item.sizeBytes)}</span>
      {!isNil(item.durationSec) && item.kind !== 'image' && (
        <span className="tabular-nums">{formatSecondsShort(item.durationSec)}</span>
      )}
    </>
  )
}
