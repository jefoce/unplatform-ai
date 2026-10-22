'use client'

import { forwardRef } from 'react'
import type {
  BeautifulMentionComponentProps,
  BeautifulMentionsItemData,
} from 'lexical-beautiful-mentions'

import { slotLabel } from '@/core/prompt-tokens'
import { thumbUrl } from '@/features/media-picker/api'
import { cn } from '@/lib/cn'

import { mentionSlot } from './prompt-convert'
import { ReferenceIcon } from './ReferenceIcon'
import { uploadForSlot, useGeneratorStore } from './store'

/** Inline slot chip, resolved live to the attached upload. */
export const ReferenceChip = forwardRef<
  HTMLSpanElement,
  BeautifulMentionComponentProps<Record<string, BeautifulMentionsItemData>>
>(function ReferenceChip(props, ref) {
  const { value, data, className, classNameFocused, 'data-beautiful-mention': mentionAttr } = props
  const slot = mentionSlot(value, data)
  const upload = useGeneratorStore((state) => uploadForSlot(state, slot))
  const label = slotLabel(slot)
  const title = upload ? `${label} \u00b7 ${upload.originalName}` : `${label} is not attached`

  return (
    <span
      ref={ref}
      data-beautiful-mention={mentionAttr}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-0.5 align-middle text-xs font-medium',
        upload ? 'bg-lime/10 text-lime' : 'bg-danger/10 text-danger',
        className,
        classNameFocused,
      )}
    >
      {upload && slot.kind !== 'audio' ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload thumb
        <img
          src={thumbUrl({ ref: `uploads/${upload.id}`, w: 32 })}
          alt=""
          className="size-4 rounded-xs object-cover"
        />
      ) : (
        <ReferenceIcon kind={slot.kind} size={12} />
      )}
      <span>@{label}</span>
    </span>
  )
})
