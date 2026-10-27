'use client'

import { type KeyboardEvent, useState } from 'react'

import { isNonEmptyString } from '@/core/guards'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'

import { uploadThumb } from '../actions/record-view'
import { openThumb, type ThumbItem } from './thumb-item'

interface InputThumbProps {
  item: ThumbItem
  items: ThumbItem[]
  index: number
}

/** One input thumb, grey initial when the file is gone. */
export function InputThumb(props: InputThumbProps) {
  const { item, items, index } = props
  const [isBroken, setIsBroken] = useState(false)
  const firstChar = item.name.charAt(0).toUpperCase()
  const initial = firstChar === '' ? '?' : firstChar

  const handleOpen = () => {
    return void openThumb({ item, items, index })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleOpen()
  }

  const handleError = () => {
    setIsBroken(true)
  }

  const title = `${item.label} \u00b7 ${item.name}`
  const sent = item.sent
  const isContent = !isNonEmptyString(sent)

  const content = isContent ? title : `${title} \u00b7 ${sent}`

  return (
    <Tooltip content={content}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        className={cn(
          'group relative size-10 cursor-pointer overflow-hidden rounded-lg border border-line bg-subtle transition-transform hover:z-10 hover:scale-125 hover:rotate-0',
          index % 2 === 0 && '-rotate-[5deg]',
          !(index % 2 === 0) && 'rotate-[5deg]',
        )}
      >
        {(isBroken || item.missing) && (
          <span className="flex size-full items-center justify-center text-xs font-medium text-fg-2">
            {initial}
          </span>
        )}
        {!isBroken && !item.missing && (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload thumb
          <img
            src={uploadThumb(item.id)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={handleError}
            className="size-full rounded-[inherit] bg-black/40 object-cover"
          />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/50"
          aria-hidden
        />
      </div>
    </Tooltip>
  )
}
