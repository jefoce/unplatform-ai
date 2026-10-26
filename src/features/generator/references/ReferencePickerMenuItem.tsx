'use client'

import { forwardRef } from 'react'
import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions'
import { isString } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'

import { ReferenceIcon } from './ReferenceIcon'

function hasThumbSrc(thumbSrc: string | null): boolean {
  return isNonEmptyString(thumbSrc)
}

function dataSelectedValue(isSelected: boolean | undefined): true | undefined {
  if (isSelected === true) {
    return true
  }

  return
}

/** One typeahead row: thumb plus slot label. */
export const ReferencePickerMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  function ReferencePickerMenuItem(props, ref) {
    const { selected, item, className, tabIndex } = props

    const thumb = item.data?.thumb
    const kind = item.data?.kind
    const isThumbSrc = isString(thumb)

    const thumbSrc = isThumbSrc ? thumb : null
    const iconKind = kind ?? 'image'
    const hasThumb = hasThumbSrc(thumbSrc)

    return (
      <li
        ref={ref}
        tabIndex={tabIndex}
        role="menuitem"
        data-selected={dataSelectedValue(selected)}
        aria-label={`Choose ${item.displayValue}`}
        onClick={props.onClick}
        onMouseDown={props.onMouseDown}
        onMouseEnter={props.onMouseEnter}
        className={cn(
          'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium text-fg hover:bg-white/5',
          Boolean(selected) && 'bg-white/10 text-lime',
          className,
        )}
      >
        {hasThumb && (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload thumb
          <img src={thumbSrc ?? undefined} alt="" className="size-6 rounded-sm object-cover" />
        )}
        {!hasThumb && <ReferenceIcon kind={iconKind} size={14} />}
        <span className="shrink-0 font-medium">{item.displayValue}</span>
      </li>
    )
  },
)
