'use client'

import { isNil } from 'lodash-es'
import { Link2 } from 'lucide-react'

import { KIND_TITLE } from '@/core/media-kinds'
import type { UploadItem } from '@/core/types'

import type { PreviewActions } from './preview-store'
import { PreviewMeta } from './PreviewMeta'

interface PreviewHeaderProps {
  item: UploadItem | undefined
  actions: PreviewActions | undefined
}

/** Name, source badge and size/length metadata for the current item. */
export function PreviewHeader(props: PreviewHeaderProps) {
  const { item, actions } = props
  const label = item ? (actions?.label?.(item) ?? KIND_TITLE[item.kind]) : 'File missing'
  const isLink = item?.source === 'link'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{item?.originalName ?? 'File missing'}</span>
        {isLink && (
          <span className="flex shrink-0 items-center gap-1 rounded-sm bg-black/40 px-1.5 py-0.5 text-xxs text-fg-2">
            <Link2 size={11} aria-hidden />
            Link
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-fg-2">
        <span className="rounded-sm bg-white/5 px-1.5 py-0.5 font-medium text-fg">{label}</span>
        {!isNil(item) && <PreviewMeta item={item} />}
      </div>
    </header>
  )
}
