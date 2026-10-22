'use client'

import { forwardRef } from 'react'
import type { BeautifulMentionsMenuItemProps } from 'lexical-beautiful-mentions'
import { isNil, isString } from 'lodash-es'

import { cn } from '@/lib/cn'

import { ReferenceIcon } from './ReferenceIcon'

/** One typeahead row: thumb plus slot label. */
export const ReferencePickerMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  function ReferencePickerMenuItem(props, ref) {
    const {
      selected,
      item,
      className,
      onClick: handleClick,
      onMouseDown: handleMouseDown,
      onMouseEnter: handleMouseEnter,
      tabIndex,
    } = props
    const thumb = item.data?.thumb
    const kind = item.data?.kind
    const thumbSrc = isString(thumb) ? thumb : null

    return (
      <li
        ref={ref}
        tabIndex={tabIndex}
        role="menuitem"
        data-selected={Boolean(selected) ? true : undefined}
        aria-label={`Choose ${item.displayValue}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        className={cn(
          'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-medium text-fg hover:bg-white/5',
          Boolean(selected) && 'bg-white/10 text-lime',
          className,
        )}
      >
        {isNil(thumbSrc) || thumbSrc === '' ? (
          <ReferenceIcon kind={kind === 'video' || kind === 'audio' ? kind : 'image'} size={14} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload thumb
          <img src={thumbSrc} alt="" className="size-6 rounded-sm object-cover" />
        )}
        <span className="shrink-0 font-medium">{item.displayValue}</span>
      </li>
    )
  },
)
