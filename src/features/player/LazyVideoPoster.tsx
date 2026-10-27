'use client'

import { isEmpty } from 'lodash-es'
import { Video } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/lib/cn'

import { LazyVideoPlayButton } from './LazyVideoPlayButton'

interface LazyVideoPosterProps {
  poster?: string
  alt?: string
  posterFit: 'cover' | 'contain'
  showPlay: boolean
  onPlay: (event: MouseEvent<HTMLButtonElement>) => void
}

/** Poster or placeholder shown until this player owns a slot. */
export function LazyVideoPoster(props: LazyVideoPosterProps) {
  const { poster, alt, posterFit, showPlay: shouldShowPlay } = props

  return (
    <>
      {isEmpty(poster) && (
        <div className="flex size-full items-center justify-center rounded-[inherit] bg-subtle">
          <Video className="size-8 text-fg-2" aria-hidden />
        </div>
      )}
      {!isEmpty(poster) && (
        // eslint-disable-next-line @next/next/no-img-element -- posters are pre-sized thumbs
        <img
          src={poster}
          loading="lazy"
          decoding="async"
          alt={alt ?? ''}
          className={cn(
            'size-full rounded-[inherit] bg-black',
            posterFit === 'cover' && 'object-cover',
            !(posterFit === 'cover') && 'object-contain',
          )}
        />
      )}
      {shouldShowPlay && <LazyVideoPlayButton label="Play video" onPlay={props.onPlay} />}
    </>
  )
}
