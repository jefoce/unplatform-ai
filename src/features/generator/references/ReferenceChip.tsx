'use client'

import { forwardRef } from 'react'
import type {
  BeautifulMentionComponentProps,
  BeautifulMentionsItemData,
} from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import { slotLabel } from '@/core/prompt-tokens'
import type { Dict } from '@/core/utility-types'
import { thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { RetryImage } from '@/ui/RetryImage'

import { mentionSlot } from '../prompt/prompt-convert'
import { useGeneratorStore } from '../store/store'
import { uploadForSlot } from '../store/store-helpers'
import { ReferenceIcon } from './ReferenceIcon'

/** Inline slot chip, resolved live to the attached upload. */
export const ReferenceChip = forwardRef<
  HTMLSpanElement,
  BeautifulMentionComponentProps<Dict<BeautifulMentionsItemData>>
>(function ReferenceChip(props, ref) {
  const { value, data, className, classNameFocused, 'data-beautiful-mention': mentionAttr } = props
  const slot = mentionSlot(value, data)

  const upload = useGeneratorStore((state) => {
    return uploadForSlot(state, slot)
  })

  const label = slotLabel(slot)
  const title = upload ? `${label} \u00b7 ${upload.originalName}` : `${label} is not attached`

  return (
    <span
      ref={ref}
      data-beautiful-mention={mentionAttr}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-0.5 align-middle text-xs font-medium',
        upload && 'bg-lime/10 text-lime',
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
