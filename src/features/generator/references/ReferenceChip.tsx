'use client'

import { forwardRef } from 'react'
import type {
  BeautifulMentionComponentProps,
  BeautifulMentionsItemData,
} from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import { type RefSlot, slotLabel } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { Dict } from '@/core/utility-types'
import { thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { RetryImage } from '@/ui/RetryImage'

import { mentionSlot, type PromptMentions } from '../prompt/prompt-convert'
import { usePromptMentions } from '../prompt/PromptMentionsProvider'
import { uploadForSlot } from '../store/store-helpers'
import { ReferenceIcon } from './ReferenceIcon'

function uploadAt(mentions: PromptMentions | null, slot: RefSlot): UploadItem | undefined {
  if (isNil(mentions)) {
    return undefined
  }

  return uploadForSlot(mentions, slot)
}

/** Inline slot chip, resolved live to the attached upload. */
export const ReferenceChip = forwardRef<
  HTMLSpanElement,
  BeautifulMentionComponentProps<Dict<BeautifulMentionsItemData>>
>(function ReferenceChip(props, ref) {
  const { value, data, className, classNameFocused, 'data-beautiful-mention': mentionAttr } = props
  const slot = mentionSlot(value, data)

  const mentions = usePromptMentions()
  const upload = uploadAt(mentions, slot)

  const label = slotLabel(slot)
  const title = upload ? `${label} \u00b7 ${upload.originalName}` : `${label} is not attached`

  return (
    <span
      ref={ref}
      data-beautiful-mention={mentionAttr}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-0.5 align-middle text-xs font-medium',
        upload && 'bg-accent/10 text-accent',
        !upload && 'bg-danger/10 text-danger',
        className,
        classNameFocused,
      )}
    >
      {!isNil(upload) && slot.kind !== 'audio' && (
        <RetryImage
          src={thumbUrl({ ref: `uploads/${upload.id}`, w: 32 })}
          alt=""
          kind={slot.kind}
          placeholder={<span />}
          className="size-4 rounded-xs object-cover"
        />
      )}
      {(isNil(upload) || slot.kind === 'audio') && <ReferenceIcon kind={slot.kind} size={12} />}
      <span>@{label}</span>
    </span>
  )
})
