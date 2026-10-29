'use client'

import { isNil } from 'lodash-es'
import { Play } from 'lucide-react'

import type { MediaKind } from '@/core/media-types'
import { formatSecondsExact } from '@/lib/format'
import { RetryImage } from '@/ui/RetryImage'

import { MediaTileBrokenPreview } from './MediaTileBrokenPreview'

interface MediaTilePreviewProps {
  kind: MediaKind
  thumbSrc: string
  durationSec?: number
}

/** Thumbnail, broken fallback and kind overlays for a media tile. */
export function MediaTilePreview(props: MediaTilePreviewProps) {
  const { kind, thumbSrc, durationSec } = props
  const isPreviewable = kind === 'image' || kind === 'video'
  const isVideo = kind === 'video'

  return (
    <>
      {isPreviewable && (
        <RetryImage
          src={thumbSrc}
          loading="lazy"
          alt=""
          kind={kind}
          placeholder={<MediaTileBrokenPreview kind={kind} />}
          className="pointer-events-none absolute inset-0 size-full rounded-[inherit] bg-black/40 object-cover"
        />
      )}

      {isVideo && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="size-7 fill-current" aria-hidden />
        </span>
      )}

      {isVideo && !isNil(durationSec) && durationSec > 0 && (
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-sm bg-black/60 px-1 text-xxs">
          {formatSecondsExact(durationSec)}
        </span>
      )}
    </>
  )
}
