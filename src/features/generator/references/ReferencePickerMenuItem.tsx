'use client'

import { forwardRef, type MouseEvent } from 'react'
import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions'
import { isString } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'
import { RetryImage } from '@/ui/RetryImage'

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

/* eslint-disable jsx-a11y/role-supports-aria-props -- library passes aria-selected on menuitem */

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

    const handleMouseDown = (event: MouseEvent<HTMLLIElement>) => {
      props.onMouseEnter?.()
      props.onMouseDown?.(event)
    }

    const handleMouseMove = (event: MouseEvent<HTMLLIElement>) => {
      props.onMouseEnter?.()
      props.onMouseMove?.(event)
    }

    return (
      <li
        ref={ref}
        tabIndex={tabIndex}
        role="menuitem"
        aria-selected={selected}
        data-selected={dataSelectedValue(selected)}
        aria-label={`Choose ${item.displayValue}`}
        onClick={props.onClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={props.onMouseEnter}
        onMouseMove={handleMouseMove}
        className={cn(
          'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium text-fg hover:bg-white/5',
          Boolean(selected) && 'bg-white/10 text-accent',
          className,
        )}
      >
        {hasThumb && (
          <RetryImage
            src={thumbSrc ?? ''}
            alt=""
            kind={iconKind}
            placeholder={<span />}
            className="size-6 rounded-sm object-cover"
          />
        )}
        {!hasThumb && <ReferenceIcon kind={iconKind} size={14} />}
        <span className="shrink-0 font-medium">{item.displayValue}</span>
      </li>
    )
  },
)
