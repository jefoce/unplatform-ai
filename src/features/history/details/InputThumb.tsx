'use client'

import { type KeyboardEvent } from 'react'

import { isNonEmptyString } from '@/core/guards'
import { uploadThumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'
import { waveBars } from '@/lib/wave-bars'
import { RetryImage } from '@/ui/RetryImage'
import { Tooltip } from '@/ui/Tooltip'

import { openThumb, type ThumbItem } from './thumb-item'

const AUDIO_THUMB_BARS = 12

interface InputThumbProps {
  item: ThumbItem
  items: ThumbItem[]
  index: number
}

/** One input thumb, grey initial when the file is gone. */
export function InputThumb(props: InputThumbProps) {
  const { item, items, index } = props
  const firstChar = item.name.charAt(0).toUpperCase()
  const initial = firstChar === '' ? '?' : firstChar
  const isAudio = item.kind === 'audio'
  const audioBars = waveBars(item.name, AUDIO_THUMB_BARS)

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

  const title = `${item.label} \u00b7 ${item.name}`
  const sent = item.sent
  const isContent = !isNonEmptyString(sent)

  const content = isContent ? title : `${title} \u00b7 ${sent}`

  const initialBadge = (
    <span className="flex size-full items-center justify-center text-xs font-medium text-fg-2">
      {initial}
    </span>
  )

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
        {item.missing && initialBadge}
        {!item.missing && isAudio && (
          <span data-audio-thumb className="flex size-full items-center gap-px bg-white/5 px-1">
            {audioBars.map((height, barIndex) => {
              return (
                <span
                  /* eslint-disable-next-line react/no-array-index-key -- static list */
                  key={barIndex}
                  style={{ height: `${height}%` }}
                  className="min-w-px flex-1 rounded-full bg-fg-2/60"
                />
              )
            })}
          </span>
        )}
        {!item.missing && !isAudio && (
          <RetryImage
            src={uploadThumbUrl(item.id)}
            alt=""
            loading="lazy"
            decoding="async"
            placeholder={initialBadge}
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
